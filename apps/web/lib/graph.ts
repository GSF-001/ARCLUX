// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Client fetch helper for /api/graph. Extracted from the duplicated
// fetch+parse pattern in GraphProvider.tsx and DependencyList.tsx.
//
// This only wraps the /api/graph request/response shape -- it does not
// own graph state (transform, positions, selection). That's
// GraphProvider.tsx's job via React Context; see
// progres/PROGRES-decisions.md (2026-08-03) for why those two concerns
// stay separate.

import { fetchJson } from "@/lib/api";
import type { DependencyGraph } from "@/packages/shared/types";

export async function fetchGraph(
  repoUrl: string,
  branch?: string
): Promise<DependencyGraph> {
  return fetchJson<DependencyGraph>("/api/graph", { repoUrl, branch });
}
