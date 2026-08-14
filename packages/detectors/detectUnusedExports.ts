// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Traversal strategy (walk import graph downward, follow re-export chains,
// treat namespace imports conservatively) adapted from webpro-nl/knip (MIT)
// — see graph-explorer/operations/is-referenced.ts in that project. Not a
// direct port: ARCLUX's ModuleInfo/ResolvedImport shape is different from
// knip's ModuleGraph, so this is re-implemented against ARCLUX's own types.

import type { Repository } from "../repository/Repository";
import type { ModuleInfo } from "../shared/types";
import { detectEntryPoints } from "./detectEntryPoints";
import { getEntryModuleIds } from "../indexer/resolveRoutes";

export interface UnusedExportFinding {
  filePath: string;
  exportName: string;
  exportKind: "default" | "named" | "re-export";
  line: number;
  message: string;
}

interface ImporterRef {
  importerId: string;
  namedImports: string[];
  hasDefaultImport: boolean;
  hasNamespaceImport: boolean;
}

interface ReExporterRef {
  reExporterId: string;
  exportName: string;
}

/**
 * moduleId -> every module that imports it, with identifier-level detail.
 * Built fresh per run from ResolvedImport data — not cached on Repository,
 * since this is detector-specific and Repository.importedBy only tracks
 * module-level, not identifier-level, relationships.
 */
function buildImportersIndex(modules: ModuleInfo[]): Map<string, ImporterRef[]> {
  const index = new Map<string, ImporterRef[]>();

  for (const module of modules) {
    for (const resolved of module.resolvedImports) {
      const list = index.get(resolved.moduleId) ?? [];
      list.push({
        importerId: module.id,
        namedImports: resolved.namedImports,
        hasDefaultImport: resolved.hasDefaultImport,
        hasNamespaceImport: resolved.hasNamespaceImport,
      });
      index.set(resolved.moduleId, list);
    }
  }

  return index;
}

/**
 * moduleId -> every module that re-exports one of its exports, with the
 * exported name under which it's re-exported. Needed so a chain like
 * util.ts -> export { helper } from util.ts (in index.ts) -> import
 * { helper } from index.ts (in consumer.ts) resolves back through index.ts
 * to find consumer.ts, rather than stopping at index.ts's own importedBy.
 */
function buildReExportersIndex(modules: ModuleInfo[]): Map<string, ReExporterRef[]> {
  const index = new Map<string, ReExporterRef[]>();

  for (const module of modules) {
    for (const [exportName, targetModuleId] of Object.entries(module.resolvedReExports)) {
      const list = index.get(targetModuleId) ?? [];
      list.push({ reExporterId: module.id, exportName });
      index.set(targetModuleId, list);
    }
  }

  return index;
}

/**
 * Whether `exportName` from `moduleId` is referenced anywhere in the repo,
 * directly or through a chain of re-exports.
 *
 * Scope boundary (real, not a placeholder): ARCLUX's parser output records
 * what's imported, not what's referenced inside an importer's body — there
 * is no reference-extraction pass anywhere in the pipeline. Consequences:
 *   - A namespace import (`import * as ns from "./file"`) is treated as
 *     using ALL of that module's exports. We cannot tell which property of
 *     `ns` actually gets accessed without body-level reference extraction,
 *     so this stays conservative rather than guessing and false-flagging.
 *   - This function proves "exported but never imported by anyone, even
 *     transitively" — not "imported but never used." That's a narrower,
 *     but fully accurate, claim given current data.
 *   - Aliased re-exports (`export { foo as bar } from "./x"`) will not
 *     chain correctly — see the comment on `resolvedReExports` in
 *     shared/types.ts for why.
 *   - Entry points (Next.js App Router files, CLI entry) are excluded
 *     up front — they're invoked by framework/runtime convention, not by
 *     an import statement, so their exports must never be flagged as
 *     unused. See buildEntryModuleIds() below.
 */
function isExportUsed(
  moduleId: string,
  exportName: string,
  isDefault: boolean,
  importersIndex: Map<string, ImporterRef[]>,
  reExportersIndex: Map<string, ReExporterRef[]>,
  seen: Set<string> = new Set()
): boolean {
  const seenKey = `${moduleId}::${exportName}`;
  if (seen.has(seenKey)) return false; // guards against circular re-export chains
  seen.add(seenKey);

  const importers = importersIndex.get(moduleId) ?? [];
  for (const importer of importers) {
    if (importer.hasNamespaceImport) return true;
    if (isDefault && importer.hasDefaultImport) return true;
    if (!isDefault && importer.namedImports.includes(exportName)) return true;
  }

  const reExporters = reExportersIndex.get(moduleId) ?? [];
  for (const reExporter of reExporters) {
    if (reExporter.exportName !== exportName) continue;
    if (
      isExportUsed(reExporter.reExporterId, exportName, isDefault, importersIndex, reExportersIndex, seen)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Module ids that are entry points by convention and must be skipped by
 * unused-export / orphan-file detection:
 * - Next.js App Router files (page/layout/route/loading/error/... under
 *   app/) via indexer/resolveRoutes.ts's convention-based classifier —
 *   matches regardless of whether anything imports them.
 * - Orphaned modules matching detectEntryPoints.ts's known entry-point
 *   conventions (e.g. apps/cli/index.ts).
 */
function buildEntryModuleIds(repository: Repository): Set<string> {
  const modules = repository.getAllModules();
  const ids = new Set<string>(getEntryModuleIds(modules));
  for (const finding of detectEntryPoints(repository)) {
    ids.add(finding.filePath);
  }
  return ids;
}

export function detectUnusedExports(repository: Repository): UnusedExportFinding[] {
  const modules = repository.getAllModules();
  const importersIndex = buildImportersIndex(modules);
  const reExportersIndex = buildReExportersIndex(modules);
  const entryModuleIds = buildEntryModuleIds(repository);
  const findings: UnusedExportFinding[] = [];

  for (const module of modules) {
    if (entryModuleIds.has(module.id)) continue;

    for (const exp of module.exports) {
      // Re-export entries forward another module's export under this
      // file's namespace — they're not "the" export being defined here,
      // so they're checked via the module they point to, not flagged
      // standalone.
      if (exp.kind === "re-export") continue;

      const isDefault = exp.kind === "default";
      const used = isExportUsed(module.id, exp.name, isDefault, importersIndex, reExportersIndex);

      if (!used) {
        findings.push({
          filePath: module.file.relativePath,
          exportName: exp.name,
          exportKind: exp.kind,
          line: exp.line,
          message: `Export "${exp.name}" is never imported anywhere in the repository.`,
        });
      }
    }
  }

  return findings;
}
