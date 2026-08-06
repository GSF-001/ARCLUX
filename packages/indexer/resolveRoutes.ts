// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { posix } from "node:path";
import type { ModuleInfo } from "../shared/types";

/**
 * ARCLUX Route Resolver
 *
 * Mendeteksi entry file Next.js App Router (page, layout, route, loading,
 * error, not-found, template, default, global-error) di dalam folder
 * `app/`, supaya detector (detectUnusedExports.ts, detectOrphanFiles.ts)
 * bisa menganggap file ini sebagai entry point yang sengaja — Next.js
 * memanggilnya lewat file-based routing, bukan lewat import eksplisit di
 * kode manapun, jadi tanpa ini semua file ini ke-flag false positive.
 *
 * Cara pakai di detectUnusedExports.ts / detectOrphanFiles.ts:
 *   const entryModuleIds = getEntryModuleIds(allModules);
 *   if (entryModuleIds.has(mod.id)) continue; // ini entry point, skip
 */

const NEXT_APP_ROUTER_ENTRY_FILENAMES = new Set([
  "page",
  "layout",
  "route",
  "loading",
  "error",
  "not-found",
  "template",
  "default",
  "global-error",
]);

const NEXT_APP_ROUTER_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

export interface RouteEntry {
  /** ModuleInfo.id dari module yang bersangkutan */
  moduleId: string;
  /** ModuleInfo.file.relativePath, POSIX-style */
  relativePath: string;
  /** e.g. "page", "layout", "route" */
  kind: string;
  /** URL-ish path hasil derive dari struktur folder, e.g. "/[org]/[repo]/graph" */
  routePath: string;
}

/**
 * Dari semua ModuleInfo yang dikenal di repo, filter yang merupakan entry
 * file Next.js App Router.
 */
export function resolveRoutes(modules: ModuleInfo[]): RouteEntry[] {
  const entries: RouteEntry[] = [];

  for (const mod of modules) {
    const relativePath = mod.file.relativePath;
    const segments = relativePath.split("/");

    if (!segments.includes("app")) continue;

    const ext = posix.extname(relativePath);
    if (!NEXT_APP_ROUTER_EXTENSIONS.has(ext)) continue;

    const base = posix.basename(relativePath, ext);
    if (!NEXT_APP_ROUTER_ENTRY_FILENAMES.has(base)) continue;

    entries.push({
      moduleId: mod.id,
      relativePath,
      kind: base,
      routePath: deriveRoutePath(relativePath),
    });
  }

  return entries;
}

/**
 * Ubah relativePath kayak "apps/web/app/[org]/[repo]/graph/page.tsx" jadi
 * route path kayak "/[org]/[repo]/graph". Route group dalam kurung, misal
 * "(marketing)", di-strip karena gak mempengaruhi URL beneran.
 */
function deriveRoutePath(relativePath: string): string {
  const segments = relativePath.split("/");
  const appIndex = segments.lastIndexOf("app");
  if (appIndex === -1) return "/";

  const routeSegments = segments
    .slice(appIndex + 1, -1) // buang sampe & termasuk "app", buang nama file-nya sendiri
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")"))); // strip route group

  return "/" + routeSegments.join("/");
}

/**
 * Helper: Set berisi ModuleInfo.id yang harus dikecualikan dari "unused
 * export" / "orphan file" detection karena Next.js memanggil module ini
 * secara implisit lewat file-based routing.
 */
export function getEntryModuleIds(modules: ModuleInfo[]): Set<string> {
  return new Set(resolveRoutes(modules).map((entry) => entry.moduleId));
}
