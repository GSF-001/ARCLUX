// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";

/** Patterns always excluded, regardless of what .gitignore says */
const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  "*.lock",
];

/**
 * Reads .gitignore (if present) at repo root and returns a matcher.
 * Usage: `const ig = readGitignore(rootPath); if (ig.ignores(relPath)) skip();`
 */
export function readGitignore(rootPath: string): Ignore {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES);

  const gitignorePath = join(rootPath, ".gitignore");
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    ig.add(content);
  }

  return ig;
}
