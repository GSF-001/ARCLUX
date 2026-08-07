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
 * ARCLUX Component Resolver
 *
 * HEURISTIK DOANG, bukan dari data AST parser -- belum ada parser yang
 * ngisi ParsedFile.meta dengan info "ini React component apa bukan"
 * (dicek dulu di extractJs.ts / parseTs.ts sebelum nulis ini; yang ada
 * baru extractCallsJs yang direncanain, belum soal component detection).
 * Kalau nanti ada signal level-parser (misal return type JSX), pake itu,
 * jangan tetep pake heuristik nama file ini.
 *
 * Heuristik sekarang: export dianggap component kalau:
 *   1. ekstensi file .tsx atau .jsx (file .ts/.js polos gak bisa punya
 *      JSX dalam pengertian konvensional), DAN
 *   2. nama export-nya PascalCase (konvensi React -- huruf kecil di awal
 *      dianggap HTML tag biasa, bukan component)
 */

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const COMPONENT_EXTENSIONS = new Set([".tsx", ".jsx"]);

export interface ComponentEntry {
  moduleId: string;
  exportName: string;
  relativePath: string;
}

export function resolveComponents(modules: ModuleInfo[]): ComponentEntry[] {
  const entries: ComponentEntry[] = [];

  for (const mod of modules) {
    const ext = posix.extname(mod.file.relativePath);
    if (!COMPONENT_EXTENSIONS.has(ext)) continue;

    for (const exp of mod.exports) {
      if (exp.kind === "re-export") continue; // cuma flag tempat component-nya beneran didefinisiin
      if (!PASCAL_CASE.test(exp.name)) continue;

      entries.push({ moduleId: mod.id, exportName: exp.name, relativePath: mod.file.relativePath });
    }
  }

  return entries;
}
