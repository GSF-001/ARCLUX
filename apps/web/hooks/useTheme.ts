// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// The theme class lives on <html> in app/layout.tsx (hardcoded `dark`,
// applied server-side — there is no inline init script in this codebase).
// This hook is purely the toggle-button state: it mirrors the current class
// via useSyncExternalStore so SSR and the first hydration render always
// agree (getServerSnapshot returns "dark", matching layout.tsx) — a lazy
// initializer reading document.documentElement instead produced a hydration
// mismatch (server Moon vs client Sun icon, issue #374).

"use client"

import { useSyncExternalStore, useCallback } from "react"

type Theme = "light" | "dark"

const THEME_CHANGE_EVENT = "arclux-theme-change"

function subscribe(callback: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback)
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function getServerSnapshot(): Theme {
  // Matches layout.tsx's hardcoded `dark` class. React uses this for SSR AND
  // the first hydration render, then switches to getSnapshot — so the two
  // sides can never render a different icon (issue #374).
  return "dark"
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark"
    document.documentElement.classList.toggle("dark", next === "dark")
    localStorage.setItem("arclux-theme", next)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }, [theme])

  return { theme, toggleTheme }
}
