// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ModuleInfo } from "../shared/types";

/**
 * ARCLUX Export Chain Resolver
 *
 * buildIndex.ts sudah ngisi ModuleInfo.resolvedReExports untuk re-export
 * LANGSUNG (export { x } from "./y") -- lihat doc comment-nya sendiri di
 * types.ts soal limitasi aliased re-export. Yang belum di-handle: CHAIN
 * lintas beberapa hop -- kalau A re-export dari B, dan B re-export nama
 * yang sama dari C, resolvedReExports di A cuma nunjuk ke B, gak sampe ke
 * C tempat simbolnya beneran didefinisiin.
 *
 * Resolver ini jalanin chain itu sampe ketemu origin module untuk setiap
 * simbol yang di-re-export, lintas seluruh module graph.
 */

export interface ResolvedExportOrigin {
  moduleId: string;
  exportName: string;
  /** true kalau export ini didefinisiin langsung di sini, bukan re-export */
  isOrigin: boolean;
  /** jumlah hop buat nyampe sini, 0 kalau isOrigin true */
  hops: number;
}

/**
 * Buat tiap module + nama export, jalanin chain resolvedReExports sampe
 * ketemu module yang nama itu BUKAN re-export (atau chain-nya dead-end /
 * cycle, dalam hal ini berhenti di hop terakhir yang masih bisa di-resolve).
 */
export function resolveExportOrigins(
  modules: ModuleInfo[]
): Map<string, Map<string, ResolvedExportOrigin>> {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const result = new Map<string, Map<string, ResolvedExportOrigin>>();

  for (const mod of modules) {
    const perModule = new Map<string, ResolvedExportOrigin>();
    for (const exp of mod.exports) {
      perModule.set(exp.name, resolveOneChain(mod.id, exp.name, byId));
    }
    result.set(mod.id, perModule);
  }

  return result;
}

function resolveOneChain(
  startModuleId: string,
  exportName: string,
  byId: Map<string, ModuleInfo>
): ResolvedExportOrigin {
  const visited = new Set<string>();
  let currentModuleId = startModuleId;
  let currentName = exportName;
  let hops = 0;

  while (true) {
    const key = `${currentModuleId}::${currentName}`;
    if (visited.has(key)) {
      // cycle -- berhenti di sini, hop terakhir adalah jawaban terbaik yang ada
      return { moduleId: currentModuleId, exportName: currentName, isOrigin: false, hops };
    }
    visited.add(key);

    const mod = byId.get(currentModuleId);
    if (!mod) {
      return { moduleId: currentModuleId, exportName: currentName, isOrigin: false, hops };
    }

    const nextModuleId = mod.resolvedReExports[currentName];
    if (!nextModuleId) {
      // bukan re-export (atau target-nya gak keresolve internal) -- ini origin-nya
      return { moduleId: currentModuleId, exportName: currentName, isOrigin: true, hops };
    }

    currentModuleId = nextModuleId;
    hops += 1;
    // CATATAN: gak handle kasus aliased re-export (export { foo as bar }
    // from "./x") yang udah didokumentasiin di doc comment ModuleInfo --
    // currentName tetep "bar" lintas hop, padahal salah kalau target
    // module export-nya sebagai "foo". Limitasi sama kayak
    // resolvedReExports sendiri; benerin ini butuh parser layer nyimpen
    // dua nama sekaligus, bukan sesuatu yang bisa dibenerin di resolver ini doang.
  }
}
