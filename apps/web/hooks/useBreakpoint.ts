// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useMediaQuery } from "@/hooks/useMediaQuery"

export interface BreakpointState {
  /** < 768px — Tailwind `md` and below. Bottom nav instead of the sidebar. */
  isMobile: boolean
  /** 768–1024px — `md` up to `lg`. Sidebar becomes an overlay drawer. */
  isTablet: boolean
  /** ≥ 1024px — `lg` and up. Inline collapsible sidebar. */
  isDesktop: boolean
}

/**
 * Breakpoint state matching Tailwind's default `md` (48rem) and `lg`
 * (64rem) prefixes — see node_modules/tailwindcss/theme.css. Built on the
 * project's existing useMediaQuery wrapper (issue #147: prefer a re-export
 * over a reimplementation). Layout visibility itself is driven by Tailwind
 * responsive classes (hydration-safe); this hook only feeds interactive
 * behavior (which gesture a button performs, which variant to render).
 */
export function useBreakpoint(): BreakpointState {
  const isDesktop = useMediaQuery("(min-width: 64rem)")
  const isTabletUp = useMediaQuery("(min-width: 48rem)")
  return {
    isDesktop,
    isTablet: isTabletUp && !isDesktop,
    isMobile: !isTabletUp,
  }
}
