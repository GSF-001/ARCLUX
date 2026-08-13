// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleViolation } from "../RuleEngine";
import type { Repository } from "../../repository/Repository";
import { parsePhpRoutes } from "../../parser/php/parsePhpRoutes";

// Laravel route files the rule inspects. Only these two well-known paths
// are checked (v1 scope — custom route files loaded from a provider are
// not discoverable without booting the app, so they're out of scope).
const ROUTE_FILE_PATHS = ["routes/web.php", "routes/api.php"];

// The default Laravel layout puts controllers in app/Http/Controllers/.
// parsePhpRoutes only keeps the class basename (namespaces are dropped), so
// the conventional flat path is the only one this rule can verify. DDD-style
// layouts (e.g. controllers under app/Domains/.../Web/Controllers) will be
// flagged as missing even though the class exists — a documented v1
// limitation of the basename-only extraction.
const CONTROLLERS_DIR = "app/Http/Controllers";

export const requireController: Rule = {
  id: "laravel/require-controller",
  description: "Every route referencing a controller must resolve to a file in app/Http/Controllers",
  appliesToFramework: "laravel",

  check(repository: Repository): RuleViolation[] {
    const modules = repository.getAllModules();

    // Route files are located as indexed modules. Note: PHP files are NOT
    // indexed today (no parser is registered for .php — see parsePhp.ts's
    // header), so in a real pipeline this list is usually empty until a PHP
    // parser lands; the rule returns [] then rather than guessing.
    const routeModules = modules.filter((m) => ROUTE_FILE_PATHS.includes(m.file.relativePath));
    if (routeModules.length === 0) {
      return [];
    }

    // Controllers present as indexed modules (secondary source of truth —
    // only populated once .php files are indexed). The filesystem check
    // below is the primary one and works regardless.
    const controllerModulePaths = new Set(
      modules
        .map((m) => m.file.relativePath)
        .filter((p) => p.startsWith(`${CONTROLLERS_DIR}/`) && p.endsWith(".php"))
    );

    const violations: RuleViolation[] = [];

    for (const routeModule of routeModules) {
      let content: string;
      try {
        content = readFileSync(routeModule.file.absolutePath, "utf-8");
      } catch {
        continue; // unreadable route file — skip it, never fail the whole check
      }

      const refs = parsePhpRoutes(content, routeModule.file.relativePath);
      for (const ref of refs) {
        const expectedControllerPath = `${CONTROLLERS_DIR}/${ref.controllerName}.php`;
        const controllerExists =
          controllerModulePaths.has(expectedControllerPath) ||
          existsSync(join(repository.meta.rootPath, expectedControllerPath));

        if (controllerExists) continue;

        violations.push({
          ruleId: requireController.id,
          message: `Route in "${ref.routeFile}" (line ${ref.line}) references "${ref.controllerName}" but no file exists at "${expectedControllerPath}"`,
          filePath: ref.routeFile,
          severity: "error",
        });
      }
    }

    return violations;
  },
};
