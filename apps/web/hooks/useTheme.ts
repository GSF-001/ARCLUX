// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Fix: default was "light", and this hook was never actually called from
// app/layout.tsx (see the fix there) so it had zero effect on first paint
// regardless. Default flipped to "dark" to match ARCLUX's dark-first
// design (theme/arclux.json) and the inline init script layout.tsx now
// runs before hydration — this hook's job is now just keeping state in
// sync for the toggle button, not doing the initial theme decision alone.

"use client"

import { useEffect, useState, useCallback } from "react"

type Theme = "light" | "dark"

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      document.documentElement.classList.toggle("dark", next === "dark")
      localStorage.setItem("arclux-theme", next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
