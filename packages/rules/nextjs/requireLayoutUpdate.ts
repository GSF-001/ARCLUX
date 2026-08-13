// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Next.js App Router REQUIRES a root layout at app/layout.(tsx|jsx|ts|js) —
// the build fails without it ("The root layout must contain <html> and
// <body> tags", and more fundamentally there is no root segment to render
// into). Nested layouts (app/dashboard/layout.tsx) are optional; only the
// root one is mandatory, which is what this rule checks for.
const APP_DIR_PATTERN = /(^|\/)app\//;
const LAYOUT_FILE_PATTERN = /(^|\/)layout\.(tsx|jsx|ts|js)$/;

function directoryOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

export const requireLayoutUpdate: Rule = {
  id: "nextjs/require-layout-update",
  description: "App Router repositories must define the root layout at app/layout.tsx",
  appliesToFramework: "nextjs",

  check(repository: Repository): RuleViolation[] {
    const modules = repository.getAllModules();
    const hasAppDir = modules.some((m) => APP_DIR_PATTERN.test(m.file.relativePath));
    if (!hasAppDir) return [];

    const hasRootLayout = modules.some(
      (m) => LAYOUT_FILE_PATTERN.test(m.file.relativePath) && directoryOf(m.file.relativePath) === "app"
    );
    if (hasRootLayout) return [];

    return [
      {
        ruleId: requireLayoutUpdate.id,
        message: `App Router directory "app/" exists but no root layout at app/layout.tsx was found — the Next.js build fails without it`,
        filePath: "app/layout.tsx",
        severity: "error",
      },
    ];
  },
};
