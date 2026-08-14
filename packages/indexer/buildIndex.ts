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
import { loadAliasConfig } from "../graph/resolveAliases";
import { resolveSameScopeDependencies, type ScopedFile } from "./resolveSameScopeDependencies";
import { Repository } from "../repository/Repository";
import { readFileSync } from "node:fs";
import { getCachedParsedFile, setCachedParsedFile } from "../cache/fileCache";
import { ArcluxError } from "../shared/errors";
import type { RepositoryMeta, ModuleInfo, ParsedFile, ResolvedImport, ResolvedCall } from "../shared/types";

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
  for (const file of files) {
    const parser = parserRegistry.getParserForExtension(file.extension);
    if (!parser) continue; // no parser registered yet for this language — skip, don't crash

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

    const cached = getCachedParsedFile(file.relativePath, content);
    const parsed = cached ?? (await parser.parse(file, content));
    if (!cached) setCachedParsedFile(file.relativePath, content, parsed);

    parsedByPath.set(file.relativePath, parsed);
    contentByPath.set(file.relativePath, content);
  }

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
  const modulesByPath = new Map<string, ModuleInfo>();
  for (const [relativePath, parsed] of parsedByPath) {
    const resolvedImportIds: string[] = [];
    const resolvedImports: ResolvedImport[] = [];
    // callee name -> moduleId for every named import of this module. Used
    // below to resolve bare call sites (extractCallsJs output) to the
    // module that exports the callee. Last write wins if the same name is
    // imported from two modules — that source is a duplicate-identifier
    // error anyway, so there is no correct answer to prefer.
    const namedImportToModule = new Map<string, string>();

    for (const rawImport of parsed.imports) {
      const resolution = resolvePath(relativePath, rawImport.source, knownFiles, aliasConfig);
      if (resolution.type === "internal") {
        resolvedImportIds.push(resolution.moduleId);
        resolvedImports.push({
          moduleId: resolution.moduleId,
          kind: rawImport.kind,
          namedImports: rawImport.namedImports,
          hasDefaultImport: rawImport.hasDefaultImport,
          hasNamespaceImport: rawImport.hasNamespaceImport,
          line: rawImport.line,
        });
        for (const name of rawImport.namedImports) {
          namedImportToModule.set(name, resolution.moduleId);
        }
      }
      // external packages intentionally not added as modules — they're graph nodes, not repo modules
    }

    // Resolve bare call sites to the module exporting the callee. A call
    // whose callee is not among the module's named imports (a local
    // function, a default-imported function, or a global) is dropped here
    // on purpose — see extractJs.ts's extractCallsJs doc comment for the
    // two by-design limitations (default-import calls and
    // obj.foo()/this.foo() calls are never resolved).
    const resolvedCalls: ResolvedCall[] = [];
    for (const rawCall of parsed.calls ?? []) {
      const targetModuleId = namedImportToModule.get(rawCall.calleeName);
      if (targetModuleId) {
        resolvedCalls.push({
          moduleId: targetModuleId,
          calleeName: rawCall.calleeName,
          line: rawCall.line,
        });
      }
    }

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
