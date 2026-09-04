// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { scanFiles } from "../parser/core/scanFiles";
import { parserRegistry } from "../parser/core/ParserRegistry";
import { resolvePath } from "../graph/resolvePath";
import { resolveModuleCalls } from "../graph/resolveCalls";
import { loadAliasConfig } from "../graph/resolveAliases";
import { resolveSameScopeDependencies, type ScopedFile } from "./resolveSameScopeDependencies";
import { Repository } from "../repository/Repository";
import { readFileSync } from "node:fs";
import { getCachedParsedFile, setCachedParsedFile } from "../cache/fileCache";
import {
  getDiskCachedParsedFile,
  setDiskCachedParsedFile,
} from "../cache/diskCache";
import { ArcluxError } from "../shared/errors";
import type { RepositoryMeta, ModuleInfo, ParsedFile, RawImport, ResolvedImport, ResolvedCall } from "../shared/types";

export interface BuildIndexOptions {
  rootPath: string;
  meta: Omit<RepositoryMeta, "analyzedAt">;
}

/**
 * Full indexing pass over a repository:
 * 1. scanFiles      -> list every relevant file
 * 2. parserRegistry  -> parse each file with the right language parser
 * 3. resolveSameScopeDependencies -> for languages where scopeId is set
 *    (Go, Java - see their parsers' doc comments), find implicit same-scope
 *    references that never appear as an import statement at all
 * 4. resolvePath     -> turn raw import strings into module ids (using tsconfig
 *                       path aliases from resolveAliases.ts, plus relative resolution)
 * 5. Repository      -> populated with ModuleInfo, importedBy back-references filled in
 *
 * This is a full rebuild. For incremental updates see watcher/changeQueue.ts + updateIndex.ts.
 */
export async function buildIndex(options: BuildIndexOptions): Promise<Repository> {
  const { rootPath, meta } = options;

  const files = scanFiles(rootPath);
  const knownFiles = new Set(files.map((f) => f.relativePath));
  const aliasConfig = loadAliasConfig(rootPath);
  const repository = new Repository({ ...meta, analyzedAt: new Date().toISOString() });

  // Pass 1: parse every file. Content is kept around (contentByPath) purely
  // for resolveSameScopeDependencies's regex scan below — pass 2 doesn't
  // need it, only the already-extracted imports/exports.
  const parsedByPath = new Map<string, ParsedFile>();
  const contentByPath = new Map<string, string>();
  let filesParsed = 0;
  let filesSkippedNoParser = 0;
  const skippedByExtension: Record<string, number> = {};
  for (const file of files) {
    const parser = parserRegistry.getParserForExtension(file.extension);
    if (!parser) {
      // No parser registered yet for this language — skip, don't crash.
      // Counted so consumers can distinguish "0 Python modules" from
      // "Python files were skipped" (ScanSummary — the population-rot guard).
      filesSkippedNoParser += 1;
      skippedByExtension[file.extension] = (skippedByExtension[file.extension] ?? 0) + 1;
      continue;
    }

    let content: string;
    try {
      content = readFileSync(file.absolutePath, "utf-8");
    } catch (err) {
      throw new ArcluxError({
        code: "PARSE_FAILED",
        message: `Could not read file for parsing`,
        filePath: file.relativePath,
        cause: err,
      });
    }

    // Cache tiers: in-memory first (same process), then disk
    // (cross-process — daemon / future MCP server / repeat CLI runs).
    // Both are keyed by content hash, so a miss is always safe to
    // fall through to the real parser.
    const memCached = getCachedParsedFile(file.relativePath, content);
    const parsed =
      memCached ??
      getDiskCachedParsedFile(content) ??
      (await parser.parse(file, content));
    if (!memCached) {
      setCachedParsedFile(file.relativePath, content, parsed);
      setDiskCachedParsedFile(content, parsed);
    }

    parsedByPath.set(file.relativePath, parsed);
    contentByPath.set(file.relativePath, content);
    filesParsed += 1;
  }

  repository.scanSummary = {
    filesScanned: files.length,
    filesParsed,
    filesSkippedNoParser,
    skippedByExtension,
  };

  // Pass 2: implicit same-scope dependencies (Go/Java files with no import
  // statement between siblings — see resolveSameScopeDependencies.ts).
  // Only files with a scopeId set (currently: Go, Java) participate.
  const scopedFiles: ScopedFile[] = [];
  for (const [relativePath, parsed] of parsedByPath) {
    if (!parsed.scopeId) continue;
    scopedFiles.push({
      moduleId: relativePath,
      scopeId: parsed.scopeId,
      exports: parsed.exports,
      content: contentByPath.get(relativePath) ?? "",
    });
  }
  const implicitDepsByPath = resolveSameScopeDependencies(scopedFiles);

  // Pass 3: build ModuleInfo with resolved import ids (but importedBy not filled yet)
  // Call resolution runs through the two-pass resolver
  // (packages/graph/resolveCalls.ts — port of ManSio PR #20):
  // 3.1 verified import (incl. default-local) → 3.2 unique global →
  // 3.3 recognized external → 3.4 explicit unresolved. Ambiguous bindings
  // are refused, never last-write-wins; nothing drops silently.
  const modulesByPath = new Map<string, ModuleInfo>();

  // Pre-pass: resolve every raw import once (internal vs external) so the
  // resolver below sees both sides; externals used to vanish here.
  interface BoundImport {
    internal?: { moduleId: string; namedImports: string[]; defaultLocalName?: string };
    external?: { packageName: string; namedImports: string[]; defaultLocalName?: string };
    raw: RawImport;
  }
  const boundByPath = new Map<string, BoundImport[]>();
  const knownDependencies = new Set<string>();
  for (const [relativePath, parsed] of parsedByPath) {
    const bound: BoundImport[] = [];
    for (const rawImport of parsed.imports) {
      const resolution = resolvePath(relativePath, rawImport.source, knownFiles, aliasConfig);
      if (resolution.type === "internal") {
        bound.push({
          internal: { moduleId: resolution.moduleId, namedImports: rawImport.namedImports, defaultLocalName: rawImport.defaultLocalName },
          raw: rawImport,
        });
      } else {
        knownDependencies.add(resolution.packageName);
        bound.push({
          external: { packageName: resolution.packageName, namedImports: rawImport.namedImports, defaultLocalName: rawImport.defaultLocalName },
          raw: rawImport,
        });
      }
    }
    boundByPath.set(relativePath, bound);
  }

  // Repo-wide export maps for rungs 3.1 (verify) and 3.2 (unique global).
  const exportMap = new Map<string, Set<string>>();
  const hasDefaultExport = new Map<string, boolean>();
  const globalNameMap = new Map<string, string[]>();
  for (const [relativePath, parsed] of parsedByPath) {
    const names = new Set<string>();
    let hasDefault = false;
    for (const exp of parsed.exports) {
      if (exp.kind === "default") hasDefault = true;
      else {
        names.add(exp.name);
        const list = globalNameMap.get(exp.name) ?? [];
        if (!list.includes(relativePath)) list.push(relativePath);
        globalNameMap.set(exp.name, list);
      }
    }
    exportMap.set(relativePath, names);
    hasDefaultExport.set(relativePath, hasDefault);
  }

  for (const [relativePath, parsed] of parsedByPath) {
    const resolvedImportIds: string[] = [];
    const resolvedImports: ResolvedImport[] = [];
    const bound = boundByPath.get(relativePath) ?? [];

    for (const b of bound) {
      if (!b.internal) continue; // external packages intentionally not added as modules — they're graph nodes, not repo modules
      resolvedImportIds.push(b.internal.moduleId);
      resolvedImports.push({
        moduleId: b.internal.moduleId,
        kind: b.raw.kind,
        namedImports: b.raw.namedImports,
        hasDefaultImport: b.raw.hasDefaultImport,
        hasNamespaceImport: b.raw.hasNamespaceImport,
        line: b.raw.line,
      });
    }

    // Two-pass call resolution (replaces the old namedImportToModule
    // last-write-wins map + silent drop).
    const { resolved: resolvedCalls, unresolved: unresolvedCalls } = resolveModuleCalls({
      rawCalls: parsed.calls ?? [],
      internalImports: bound.flatMap((b) => (b.internal ? [b.internal] : [])),
      externalImports: bound.flatMap((b) => (b.external ? [b.external] : [])),
      exportMap,
      hasDefaultExport,
      globalNameMap,
      knownDependencies,
    });

    const resolvedReExports: Record<string, string> = {};
    for (const exp of parsed.exports) {
      if (exp.kind === "re-export" && exp.reExportSource) {
        const resolution = resolvePath(relativePath, exp.reExportSource, knownFiles, aliasConfig);
        if (resolution.type === "internal") {
          resolvedReExports[exp.name] = resolution.moduleId;
        }
      }
    }

    modulesByPath.set(relativePath, {
      id: relativePath,
      file: parsed.file,
      exports: parsed.exports,
      resolvedReExports,
      imports: resolvedImportIds,
      resolvedImports,
      calls: resolvedCalls,
      unresolvedCalls,
      importedBy: [], // filled in pass 4
      calledBy: [], // filled in pass 4
      implicitDependencies: implicitDepsByPath.get(relativePath) ?? [],
    });
  }

  // Pass 4: back-fill importedBy and calledBy so consumers can be queried in O(1)
  for (const module of modulesByPath.values()) {
    for (const importedId of module.imports) {
      const target = modulesByPath.get(importedId);
      if (target) {
        target.importedBy.push(module.id);
      }
    }
    for (const call of module.calls) {
      const target = modulesByPath.get(call.moduleId);
      if (target) {
        target.calledBy.push(module.id);
      }
    }
  }

  for (const module of modulesByPath.values()) {
    repository.addModule(module);
  }

  return repository;
}
