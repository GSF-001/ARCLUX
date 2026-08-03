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
// Same orphan-detection shape as detectTestConvention.ts, applied to
// Storybook *.stories.tsx files instead of *.test.ts. Kept as a separate
// detector rather than generalizing both into one "sibling file" checker,
// since story files and test files carry different meaning in a findings
// report (a stale story is a dead UI artifact; a stale test is dead
// coverage) — callers likely want to filter/display these independently.

import type { Repository } from "../repository/Repository";

export interface StoryConventionFinding {
  filePath: string;
  message: string;
}

const STORY_FILE_PATTERN = /\.stories\.(ts|tsx|js|jsx)$/;

export function detectStoryConvention(repository: Repository): StoryConventionFinding[] {
  const findings: StoryConventionFinding[] = [];
  const allBaseNames = new Set(
    repository.getAllModules().map((m) => (m.file.relativePath.split("/").pop() ?? ""))
  );

  for (const module of repository.getAllModules()) {
    const path = module.file.relativePath;
    if (!STORY_FILE_PATTERN.test(path)) continue;

    const filename = path.split("/").pop() ?? "";
    const sourceBaseName = filename.replace(/\.stories\.(ts|tsx|js|jsx)$/, (_, ext) => `.${ext}`);

    if (!allBaseNames.has(sourceBaseName)) {
      findings.push({
        filePath: path,
        message: `"${path}" has no corresponding component file ("${sourceBaseName}") anywhere in the repository — possibly a stale story.`,
      });
    }
  }

  return findings;
}
