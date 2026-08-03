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

export interface TestConventionFinding {
  filePath: string;
  message: string;
}

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

/**
 * Flags orphaned test files — a *.test.ts / *.spec.ts whose corresponding
 * source file (same name, minus the .test/.spec segment) doesn't exist
 * anywhere in the repo. This catches stale test files left behind after
 * the thing they tested was renamed or deleted, WITHOUT requiring every
 * source file to have a test (that would be a much stronger, more
 * opinionated policy this detector deliberately doesn't impose — see
 * PROGRES.md's prioritization notes on staying descriptive, not
 * prescriptive, where the codebase itself hasn't established a pattern).
 *
 * Matches by basename only, not exact directory — a test file commonly
 * lives in a parallel tests/ tree (see this repo's own tests/parser/*.test.ts
 * vs packages/parser/*) rather than colocated, so directory-strict matching
 * would false-positive on ARCLUX's own layout.
 */
export function detectTestConvention(repository: Repository): TestConventionFinding[] {
  const findings: TestConventionFinding[] = [];
  const allBaseNames = new Set(
    repository.getAllModules().map((m) => (m.file.relativePath.split("/").pop() ?? ""))
  );

  for (const module of repository.getAllModules()) {
    const path = module.file.relativePath;
    if (!TEST_FILE_PATTERN.test(path)) continue;

    const filename = path.split("/").pop() ?? "";
    const sourceBaseName = filename.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, (_, __, ext) => `.${ext}`);

    if (!allBaseNames.has(sourceBaseName)) {
      findings.push({
        filePath: path,
        message: `"${path}" has no corresponding source file ("${sourceBaseName}") anywhere in the repository — possibly a stale test.`,
      });
    }
  }

  return findings;
}
