// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";

// Next.js App Router Route Handlers: a file at app/**/route.(ts|js) is only
// reachable if it exports at least one HTTP method (GET/POST/PUT/PATCH/
// DELETE/HEAD/OPTIONS). A route file that exports none of them is dead —
// Next.js will not register it. This is the same class of finding
// detectRouteConvention reports; this rule makes it a repeatable check.
const APP_DIR_PATTERN = /(^|\/)app\//;
const ROUTE_FILE_PATTERN = /(^|\/)route\.(tsx|jsx|ts|js)$/;
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export const requireRoute: Rule = {
  id: "nextjs/require-route",
  description: "Route Handlers (app/**/route.ts) must export at least one HTTP method",
  appliesToFramework: "nextjs",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const module of repository.getAllModules()) {
      const path = module.file.relativePath;
      if (!ROUTE_FILE_PATTERN.test(path) || !APP_DIR_PATTERN.test(path)) continue;

      // Re-exports (`export { GET } from "./handlers"`) count too — the
      // handler is still reachable through the route file. Only the
      // exported NAME matters, not the export kind.
      const exportsMethod = module.exports.some((e) => HTTP_METHODS.has(e.name));
      if (exportsMethod) continue;

      violations.push({
        ruleId: requireRoute.id,
        message: `"${path}" exports no HTTP method (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS) — the route is never reachable`,
        filePath: path,
        severity: "warning",
      });
    }

    return violations;
  },
};
