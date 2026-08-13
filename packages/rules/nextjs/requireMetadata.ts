// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Next.js App Router pages should export route metadata — either the static
// `export const metadata: Metadata` object or the dynamic
// `export async function generateMetadata()` function. Without either,
// the page has no <title>/<description> contribution of its own (and no way
// to supply dynamic metadata for a params-driven route). This is a
// convention rule, so severity is warning: pages without metadata still
// build and render fine.
const APP_DIR_PATTERN = /(^|\/)app\//;
const PAGE_FILE_PATTERN = /(^|\/)page\.(tsx|jsx|ts|js)$/;
const METADATA_EXPORTS = new Set(["metadata", "generateMetadata"]);

export const requireMetadata: Rule = {
  id: "nextjs/require-metadata",
  description: "App Router pages should export metadata or generateMetadata",
  appliesToFramework: "nextjs",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const module of repository.getAllModules()) {
      const path = module.file.relativePath;
      if (!PAGE_FILE_PATTERN.test(path) || !APP_DIR_PATTERN.test(path)) continue;

      const hasMetadata = module.exports.some((e) => METADATA_EXPORTS.has(e.name));
      if (hasMetadata) continue;

      violations.push({
        ruleId: requireMetadata.id,
        message: `"${path}" exports neither metadata nor generateMetadata — the page has no title/description of its own`,
        filePath: path,
        severity: "warning",
      });
    }

    return violations;
  },
};
