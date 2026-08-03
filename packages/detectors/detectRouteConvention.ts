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

export interface RouteConventionFinding {
  filePath: string;
  message: string;
}

const NEXTJS_PAGE_FILE = /(^|\/)app\/.*\/page\.(ts|tsx)$/;
const NEXTJS_ROOT_PAGE_FILE = /(^|\/)app\/page\.(ts|tsx)$/;
const NEXTJS_ROUTE_FILE = /(^|\/)app\/.*\/route\.(ts|tsx)$/;

/**
 * Next.js App Router convention: a page.tsx must have a default export
 * (that's what Next.js actually renders — a page file with only named
 * exports silently fails to render anything); a route.ts (API route) must
 * export at least one HTTP-method-named function (GET/POST/etc — Next.js
 * dispatches by matching export name, not via a default export).
 *
 * HTTP method check is name-only (does RawExport.name match a known verb),
 * not a check that it's actually a valid handler function signature —
 * that would need parser-level type information this pipeline doesn't
 * capture.
 */
const HTTP_METHOD_NAMES = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function detectRouteConvention(repository: Repository): RouteConventionFinding[] {
  const findings: RouteConventionFinding[] = [];

  for (const module of repository.getAllModules()) {
    const path = module.file.relativePath;

    if (NEXTJS_PAGE_FILE.test(path) || NEXTJS_ROOT_PAGE_FILE.test(path)) {
      const hasDefaultExport = module.exports.some((e) => e.kind === "default");
      if (!hasDefaultExport) {
        findings.push({
          filePath: path,
          message: `"${path}" is a Next.js page but has no default export — Next.js won't render it.`,
        });
      }
    }

    if (NEXTJS_ROUTE_FILE.test(path)) {
      const hasHttpMethodExport = module.exports.some((e) => HTTP_METHOD_NAMES.has(e.name));
      if (!hasHttpMethodExport) {
        findings.push({
          filePath: path,
          message: `"${path}" is a Next.js route handler but exports no recognized HTTP method (GET/POST/etc).`,
        });
      }
    }
  }

  return findings;
}
