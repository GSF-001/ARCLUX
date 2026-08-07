// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ModuleInfo } from "../shared/types";

/**
 * ARCLUX Provider Resolver
 *
 * HEURISTIK: konvensi penamaan React context provider -- nama export
 * diakhiri "Provider" (ThemeProvider, GraphProvider, WorkspaceProvider,
 * dst -- components/graph/GraphProvider.tsx di project ini sendiri udah
 * ikutin konvensi ini persis).
 */

const PROVIDER_NAME = /Provider$/;

export interface ProviderEntry {
  moduleId: string;
  exportName: string;
  relativePath: string;
}

export function resolveProviders(modules: ModuleInfo[]): ProviderEntry[] {
  const entries: ProviderEntry[] = [];

  for (const mod of modules) {
    for (const exp of mod.exports) {
      if (exp.kind === "re-export") continue;
      if (!PROVIDER_NAME.test(exp.name)) continue;

      entries.push({ moduleId: mod.id, exportName: exp.name, relativePath: mod.file.relativePath });
    }
  }

  return entries;
}
