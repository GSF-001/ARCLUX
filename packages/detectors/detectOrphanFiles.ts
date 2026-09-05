// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.

import type { Repository } from "../repository/Repository";
import type { ModuleInfo } from "../shared/types";
import { detectEntryPoints } from "./detectEntryPoints";
import { isTestFilePath } from "./testFiles";
import { getEntryModuleIds } from "../indexer/resolveRoutes";

export type OrphanClassification = "dead" | "unwired" | "ambiguous";

export interface OrphanFileFinding {
  filePath: string;
  message: string;
  /**
   * Why this file is an orphan:
   * - "dead" — leftover code: nothing in its folder is imported by anyone,
   *   the name looks like a backup/scratch file, and/or it exports nothing.
   *   The honest advice is deletion, not integration.
   * - "unwired" — it SHOULD be wired somewhere: sibling files in the same
   *   folder (or with a shared naming pattern) ARE imported, this one just
   *   never got connected. See detectOrphanIntegration.ts for where.
   * - "ambiguous" — mixed or weak signals; neither delete nor integrate
   *   with confidence.
   */
  classification: OrphanClassification;
  /** Human-readable evidence backing the classification. */
  evidence: string[];
}

/**
 * Files that nothing else in the repository imports at all — file-level,
 * distinct from detectUnusedExports.ts which checks per-export.
 *
 * Entry points are excluded up front: a CLI's index.ts or a Next.js
 * page.tsx is never imported by other source files BY DESIGN — it's
 * invoked by the runtime/framework, so it's not an orphan. The exclusion
 * set comes from indexer/resolveRoutes.ts (App Router convention) plus
 * detectEntryPoints.ts (known entry-point conventions), mirroring what
 * detectUnusedExports.ts does.
 *
 * BUG-2 precision fixes (scope-relative honesty):
 * - Pure-barrel modules (every export is a re-export, e.g. gameserver/
 *   index.ts's `export *` wall) are public API surfaces, excluded like
 *   entries. No file I/O needed — decided from RawExport kinds alone.
 * - Config/vendor/tooling paths (*.config.*, *.d.ts, vendor-ui/, _inbox/)
 *   are skipped: reporting them as orphans buries real signal (523-noise
 *   case). Deliberately narrow — user code named *.config.ts that IS
 *   imported still shows up nowhere else, but an unimported
 *   `weird.config.ts` with real code is a corner case we accept missing
 *   in exchange for killing hundreds of false positives.
 * - Findings dedupe by filePath (upstream merges can surface the same
 *   module twice — e.g. the 9x impactStore.ts case — and one file gets
 *   one verdict).
 * - Re-export counts as weak usage: a module re-exported by an in-scope
 *   barrel but directly imported by nothing is "ambiguous" (public via
 *   barrel, consumers possibly out of scope), never "unwired". This is
 *   the cross-package honesty fix: server.ts re-exported by
 *   gameserver/index.ts must not be called unwired just because its
 *   importers (serve.ts, game) live outside the analyzed scope.
 *
 * Each orphan is classified by looking at REAL structural signals in the
 * repository (see classifyOrphan): are siblings in the same folder
 * imported anywhere? Is there a barrel index.ts that skips this file?
 * Does the name look like backup/scratch? Does the file export anything?
 */
export function detectOrphanFiles(repository: Repository): OrphanFileFinding[] {
  const entryModuleIds = new Set<string>();
  for (const id of getEntryModuleIds(repository.getAllModules())) entryModuleIds.add(id);
  for (const finding of detectEntryPoints(repository)) entryModuleIds.add(finding.filePath);

  const allModules = repository.getAllModules();

  // Pure barrels: public surface, not orphans.
  for (const m of allModules) {
    if (m.exports.length > 0 && m.exports.every((e) => e.kind === "re-export")) {
      entryModuleIds.add(m.id);
    }
  }

  // Re-export usage: moduleId -> barrel ids re-exporting it (in scope).
  const reExportedBy = new Map<string, string[]>();
  for (const m of allModules) {
    for (const targetId of Object.values(m.resolvedReExports)) {
      const list = reExportedBy.get(targetId) ?? [];
      if (!list.includes(m.id)) list.push(m.id);
      reExportedBy.set(targetId, list);
    }
  }

  const orphans = repository
    .findModulesWithNoImporters()
    .filter((module) => !entryModuleIds.has(module.id) && !isTestFilePath(module.id))
    .filter((module) => !isNoisePath(module.file.relativePath));

  const seen = new Set<string>();
  const findings: OrphanFileFinding[] = [];
  for (const module of orphans) {
    if (seen.has(module.id)) continue; // dedupe: one file, one verdict
    seen.add(module.id);
    const { classification, evidence } = classifyOrphan(module, repository, reExportedBy.get(module.id) ?? []);
    const filePath = module.file.relativePath;
    const message =
      classification === "unwired"
        ? `"${filePath}" is never imported, but sibling files in the same folder are — it looks unwired, not dead.`
        : classification === "dead"
          ? `"${filePath}" is never imported and shows dead-code signals — likely safe to delete.`
          : `"${filePath}" is never imported (ambiguous — no strong integration or deletion signal).`;
    findings.push({ filePath, message, classification, evidence });
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────
// Classification signals
// ─────────────────────────────────────────────────────────────

const BACKUP_NAME = /\.(?:bak|old|orig|tmp|copy|backup)$/i;
const SCRATCH_NAME = /(?:scratch|archive|-old|-copy|_draft|_tmp|-wip)/i;
const STORY_NAME = /\.(?:stories|story)\./i;

/**
 * Tooling/config paths that are never meaningful orphans — reporting them
 * buries real signal (BUG-2: next.config.ts, eslint.config.mjs, *.d.ts,
 * vendor-ui/, _inbox/ dominated a 523-finding run). Deliberately narrow:
 * only build/config latticed paths and vendored UI, never user code by
 * naming pattern alone.
 */
const NOISE_PATH = /(?:^|\/)(?:[^/]*\.config\.[^/]+|[^/]*\.d\.ts|vendor-ui\/|_inbox\/)/;

export function isNoisePath(relativePath: string): boolean {
  return NOISE_PATH.test(relativePath);
}

/** Shared structural suffixes (e.g. userService.ts / paymentService.ts). */
const KNOWN_SUFFIXES = [
  "Service",
  "Controller",
  "Repository",
  "Store",
  "Api",
  "Adapter",
  "Provider",
  "Helper",
  "Util",
  "Utils",
  "Page",
  "Screen",
  "Model",
  "Component",
  "Hook",
  "Factory",
  "Manager",
  "Loader",
  "Cache",
  "Router",
];

/** Shared structural prefixes (e.g. useAuth.ts / useTheme.ts). */
const KNOWN_PREFIXES = ["use", "with", "is", "get", "create", "fetch", "to", "parse", "build"];

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1].replace(/\.\w+$/, "");
}

/** Returns the shared structural pattern ("Service", "use…"), or null. */
export function sharedNamePattern(filePath: string): string | null {
  const base = baseName(filePath);
  for (const suffix of KNOWN_SUFFIXES) {
    if (base.endsWith(suffix) && base.length > suffix.length) return suffix;
  }
  for (const prefix of KNOWN_PREFIXES) {
    if (base.startsWith(prefix) && base.length > prefix.length) return `${prefix}…`;
  }
  return null;
}

/** Modules in the same folder as `module` (excluding the module itself). */
export function siblingModules(module: ModuleInfo, repository: Repository): ModuleInfo[] {
  const folder = module.file.relativePath.includes("/")
    ? module.file.relativePath.slice(0, module.file.relativePath.lastIndexOf("/"))
    : "";
  return repository.getAllModules().filter((m) => {
    if (m.id === module.id) return false;
    const other = m.file.relativePath;
    if (folder === "") return !other.includes("/");
    return other.startsWith(`${folder}/`) && !other.slice(folder.length + 1).includes("/");
  });
}

/**
 * Classifies one orphan from real repository signals, by the DOMINANT
 * structural fact (in priority order):
 *
 *   1. backup/scratch name        → dead (a file named old-backup.ts is
 *      leftover no matter what its neighbors do)
 *   2. siblings in the folder ARE imported elsewhere → unwired (the file
 *      sits inside wired code and is the only one not connected; a UI
 *      component with no exports is still unwired, not dead — it should
 *      have been exported)
 *   3. nothing in the folder is imported AND the file exports nothing  → dead
 *   4. anything else (has exports, no wired neighbors)                → ambiguous
 *
 * Story files are always ambiguous (standalone by design — story tooling
 * loads them directly, so "no importer" is expected).
 */
export function classifyOrphan(
  module: ModuleInfo,
  repository: Repository,
  reExportedByBarrels: string[] = []
): { classification: OrphanClassification; evidence: string[] } {
  const evidence: string[] = [];
  const filePath = module.file.relativePath;

  if (STORY_NAME.test(filePath)) {
    return {
      classification: "ambiguous",
      evidence: ["story file — loaded by story tooling, not by source imports (standalone by design)"],
    };
  }

  // Re-exported by an in-scope barrel but directly imported by nothing:
  // public via barrel, consumers possibly out of scope — ambiguous, never
  // unwired (cross-package honesty, BUG-2A).
  if (reExportedByBarrels.length > 0) {
    return {
      classification: "ambiguous",
      evidence: [
        `re-exported by ${reExportedByBarrels.length} in-scope barrel(s) (${reExportedByBarrels.slice(0, 3).join(", ")}) with no direct importers in this scope — consumers may live outside it`,
      ],
    };
  }

  const siblings = siblingModules(module, repository);
  const importedSiblings = siblings.filter((s) => s.importedBy.length > 0);
  const myPattern = sharedNamePattern(filePath);
  const barrelIndex = siblings.find((s) => /(^|\/)index\.\w+$/.test(s.file.relativePath));

  let classification: OrphanClassification;

  if (BACKUP_NAME.test(filePath) || SCRATCH_NAME.test(filePath)) {
    classification = "dead";
    evidence.push("name looks like a backup/scratch file");
  } else if (importedSiblings.length > 0) {
    classification = "unwired";
    evidence.push(
      `${importedSiblings.length} sibling file(s) in this folder are imported by other files, this one is not`
    );
    if (myPattern) {
      const patternSiblings = importedSiblings.filter((s) => sharedNamePattern(s.file.relativePath) === myPattern);
      if (patternSiblings.length > 0) {
        evidence.push(
          `${patternSiblings.length} file(s) sharing the "${myPattern}" pattern in this folder are imported`
        );
      }
    }
    if (barrelIndex && barrelIndex.importedBy.length > 0) {
      const indexImports = barrelIndex.imports.filter((id) => importedSiblings.some((s) => s.id === id));
      if (indexImports.length > 0) {
        evidence.push(`barrel ${barrelIndex.file.relativePath} imports ${indexImports.length} sibling(s) but not this file`);
      }
    }
  } else if (module.exports.length === 0) {
    classification = "dead";
    evidence.push("no sibling in this folder is imported anywhere and the file exports nothing");
  } else {
    classification = "ambiguous";
    evidence.push("file exports symbols but no sibling in this folder is imported anywhere — no strong signal either way");
  }

  return { classification, evidence };
}