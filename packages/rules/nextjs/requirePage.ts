// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

const APP_DIR_PATTERN = /(^|\/)app\//;

function isLayoutFile(path: string): boolean {
  return /(^|\/)layout\.(tsx|jsx|ts|js)$/.test(path) && APP_DIR_PATTERN.test(path);
}

function isPageFile(path: string): boolean {
  return /(^|\/)page\.(tsx|jsx|ts|js)$/.test(path) && APP_DIR_PATTERN.test(path);
}

function directoryOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

export const requirePage: Rule = {
  id: "nextjs/require-page",
  description: "Every layout.tsx should have at least one page.tsx in its subtree",
  appliesToFramework: "nextjs",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const modules = repository.getAllModules();

    const layoutDirs = modules
      .map((m) => m.file.relativePath)
      .filter(isLayoutFile)
      .map(directoryOf);

    const pagePaths = modules.map((m) => m.file.relativePath).filter(isPageFile);

    for (const layoutDir of layoutDirs) {
      const hasPageInSubtree = pagePaths.some(
        (pagePath) => pagePath === `${layoutDir}/page.tsx` || pagePath.startsWith(`${layoutDir}/`)
      );

      if (!hasPageInSubtree) {
        violations.push({
          ruleId: requirePage.id,
          message: `Layout at "${layoutDir}" has no page.tsx anywhere in its subtree`,
          filePath: `${layoutDir}/layout.tsx`,
          severity: "warning",
        });
      }
    }

    return violations;
  },
};
