// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.
//
// Investigated webpro-nl/knip (MIT) first, since it's already the source
// for detectUnusedExports.ts's traversal strategy. knip has no "dead code"
// issue type — its IssueType union (src/types/issues.ts) is granular:
// files, exports, types, enumMembers, namespaceMembers, duplicates, cycles,
// etc., with no umbrella "dead code" bucket. What people colloquially call
// "dead code" splits into unused files (-> detectOrphanFiles.ts already
// covers this) and unused exports (-> detectUnusedExports.ts already
// covers this), plus body-level unused class/enum members, which ARCLUX
// cannot detect at all yet (no reference-extraction pass into function/
// class bodies — same limitation documented on detectUnusedExports.ts).
//
// So this does NOT reimplement either of those. It targets a narrower,
// genuinely uncovered case: a module that IS imported by other files
// (not an orphan) but where every one of its own exports is unused
// (per detectUnusedExports). That combination usually means the file is
// only ever imported for a side effect (e.g. `import "./setup"` with
// nothing named/default/namespace referenced) — its real API is dead
// weight even though the file itself isn't orphaned. That's a blind spot
// neither detectOrphanFiles (checks "imported at all") nor
// detectUnusedExports (checks each export independently, doesn't ask
// "are ALL of this module's exports unused") covers on its own.

import type { Repository } from "../repository/Repository";
import { detectUnusedExports } from "./detectUnusedExports";

export interface DeadCodeFinding {
  filePath: string;
  unusedExportCount: number;
  importedByCount: number;
  message: string;
}

export function detectDeadCode(repository: Repository): DeadCodeFinding[] {
  const unusedExports = detectUnusedExports(repository);

  const unusedCountByFile = new Map<string, number>();
  for (const finding of unusedExports) {
    unusedCountByFile.set(finding.filePath, (unusedCountByFile.get(finding.filePath) ?? 0) + 1);
  }

  const findings: DeadCodeFinding[] = [];

  for (const module of repository.getAllModules()) {
    // Re-exports aren't "this module's own" exports — same exclusion
    // detectUnusedExports.ts applies, kept consistent here.
    const ownExports = module.exports.filter((e) => e.kind !== "re-export");
    if (ownExports.length === 0) continue;

    // Already flagged by detectOrphanFiles — don't duplicate that finding
    // under a different name.
    if (module.importedBy.length === 0) continue;

    const unusedCount = unusedCountByFile.get(module.file.relativePath) ?? 0;
    if (unusedCount === ownExports.length) {
      findings.push({
        filePath: module.file.relativePath,
        unusedExportCount: unusedCount,
        importedByCount: module.importedBy.length,
        message: `"${module.file.relativePath}" is imported by ${module.importedBy.length} file(s), but none of its ${ownExports.length} export(s) are ever referenced — likely imported only for a side effect.`,
      });
    }
  }

  return findings;
}
