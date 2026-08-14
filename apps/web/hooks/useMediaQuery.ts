// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useMediaQuery as useBaseUiMediaQuery } from "@base-ui/react/unstable-use-media-query"

export interface UseMediaQueryOptions {
  /** Value returned on the server / first client mount (default false). */
  defaultMatches?: boolean
  /** Set to true when the value is only used client-side (skips the double-render hydration pass). */
  noSsr?: boolean
}

/**
 * Thin wrapper over `@base-ui/react`'s `unstable-use-media-query` (already
 * a project dependency — see the issue #147 note: prefer a re-export over
 * a reimplementation). Exists so callers get a stable hook name and an
 * ARCLUX-sized options surface, instead of depending on the unstable-*
 * package directly in every component.
 */
export function useMediaQuery(query: string, options?: UseMediaQueryOptions): boolean {
  return useBaseUiMediaQuery(query, options ?? {})
}
