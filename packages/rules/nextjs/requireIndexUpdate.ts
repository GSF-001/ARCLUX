// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Barrel-file hygiene: when a folder has an index.ts/index.js barrel, every
// sibling module that exports something should be re-exported through it.
// A module added to the folder but not re-exported by the barrel is either
// unreachable from consumers that import the folder, or silently forgotten.
//
// Interpretation note: this file lives under nextjs/ (matching the stub
// layout), but the check itself is generic barrel hygiene and applies to any
// Next.js repo that uses index barrels in e.g. src/components.
const INDEX_FILE_PATTERN = /(^|\/)(index\.(ts|tsx|js|jsx))$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

function directoryOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

export const requireIndexUpdate: Rule = {
  id: "nextjs/require-index-update",
  description: "Every sibling module with exports should be re-exported by the folder's index barrel",
  appliesToFramework: "nextjs",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const modules = repository.getAllModules();

    const byDir = new Map<string, typeof modules>();
    for (const module of modules) {
      const dir = directoryOf(module.file.relativePath);
      const list = byDir.get(dir) ?? [];
      list.push(module);
      byDir.set(dir, list);
    }

    for (const [dir, dirModules] of byDir) {
      const index = dirModules.find((m) => INDEX_FILE_PATTERN.test(m.file.relativePath));
      if (!index) continue;

      // Not a barrel (no resolved re-exports) — nothing to "update" here;
      // flagging every folder that merely contains an index.ts would be noise.
      const reExportedTargets = new Set(Object.values(index.resolvedReExports));
      if (reExportedTargets.size === 0) continue;

      for (const sibling of dirModules) {
        if (sibling === index) continue;
        // Nothing exported, nothing to re-export; test/spec files are not
        // part of a folder's public API surface.
        if (sibling.exports.length === 0) continue;
        if (TEST_FILE_PATTERN.test(sibling.file.relativePath)) continue;
        if (reExportedTargets.has(sibling.id)) continue;

        violations.push({
          ruleId: requireIndexUpdate.id,
          message: `"${sibling.file.relativePath}" exports ${sibling.exports.length} symbol(s) but is not re-exported by "${index.file.relativePath}" — add it to the barrel`,
          filePath: index.file.relativePath,
          severity: "warning",
        });
      }
    }

    return violations;
  },
};
