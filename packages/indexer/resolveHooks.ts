// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ModuleInfo } from "../shared/types";

/**
 * ARCLUX Hook Resolver
 *
 * HEURISTIK: konvensi penamaan React hook (harus mulai "use" diikuti
 * huruf kapital/angka, sesuai rules-of-hooks yang mungkin bakal
 * di-enforce lewat packages/rules/react/ nanti). Gak dibatasin ke
 * .ts/.tsx aja -- hook bisa didefinisiin di file .ts polos (body-nya gak
 * butuh JSX), beda dari resolveComponents.ts.
 */

const HOOK_NAME = /^use[A-Z0-9]/;

export interface HookEntry {
  moduleId: string;
  exportName: string;
  relativePath: string;
}

export function resolveHooks(modules: ModuleInfo[]): HookEntry[] {
  const entries: HookEntry[] = [];

  for (const mod of modules) {
    for (const exp of mod.exports) {
      if (exp.kind === "re-export") continue;
      if (!HOOK_NAME.test(exp.name)) continue;

      entries.push({ moduleId: mod.id, exportName: exp.name, relativePath: mod.file.relativePath });
    }
  }

  return entries;
}
