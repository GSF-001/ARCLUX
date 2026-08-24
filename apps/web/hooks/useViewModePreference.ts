// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useEffect, useState } from "react"

export type ViewModePreference = "auto" | "desktop" | "mobile"

const STORAGE_KEY = "arclux-view-mode"

/**
 * Manual mobile/desktop override. "auto" defers to the media query
 * (the pre-existing behavior); the other two force the layout. Persisted
 * in localStorage so the choice survives reloads. Exposes the SYSTEM
 * width state too, so consumers can compute the effective mode.
 */
export function useViewModePreference(): {
  preference: ViewModePreference
  setPreference: (mode: ViewModePreference) => void
  /** The media-query truth — what the device actually is. */
  systemIsDesktop: boolean
  /** What the layout should render as right now. */
  effectiveIsDesktop: boolean
} {
  const [preference, setPreferenceState] = useState<ViewModePreference>("auto")
  const [systemIsDesktop, setSystemIsDesktop] = useState(true)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "desktop" || saved === "mobile" || saved === "auto") {
      setPreferenceState(saved)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const apply = () => setSystemIsDesktop(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  function setPreference(mode: ViewModePreference) {
    setPreferenceState(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
  }

  const effectiveIsDesktop =
    preference === "auto" ? systemIsDesktop : preference === "desktop"

  return { preference, setPreference, systemIsDesktop, effectiveIsDesktop }
}
