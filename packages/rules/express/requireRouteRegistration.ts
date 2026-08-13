// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";
import type { ModuleInfo } from "../../shared/types";

// Express: defining a router file is only half the work — it must be
// imported (registered) by the app wiring (usually server.js/app.js via
// `app.use("/path", router)`). A route module that nothing imports is dead:
// every route in it is unreachable. This rule flags exactly that case.
//
// A module counts as a "route module" if:
//   - its path has a `routes/` or `routers/` segment, or
//   - its filename matches `*.routes.*` / `*.router.*`, or
//   - it exports an identifier literally named `router` (the common
//     `export const router = express.Router()` pattern).
const ROUTE_DIR_PATTERN = /(^|\/)routes?\/.*\.(ts|js|mjs|cjs)$/;
const ROUTE_FILE_PATTERN = /\.(routes|router)\.(ts|js|mjs|cjs)$/;

function isRouteModule(module: ModuleInfo): boolean {
  const path = module.file.relativePath;
  if (ROUTE_DIR_PATTERN.test(path) || ROUTE_FILE_PATTERN.test(path)) return true;
  return module.exports.some((e) => e.name === "router" || e.name === "routes");
}

export const requireRouteRegistration: Rule = {
  id: "express/require-route-registration",
  description: "Express route modules must be imported (registered) by the app wiring",
  appliesToFramework: "express",

  check(repository: Repository): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const module of repository.getAllModules()) {
      if (!isRouteModule(module)) continue;
      if (module.importedBy.length > 0) continue;

      violations.push({
        ruleId: requireRouteRegistration.id,
        message: `"${module.file.relativePath}" is never imported — the router is defined but never registered (add app.use("/path", router) wiring)`,
        filePath: module.file.relativePath,
        severity: "warning",
      });
    }

    return violations;
  },
};
