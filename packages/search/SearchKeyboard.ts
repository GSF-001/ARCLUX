// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * Keyboard-shortcut specs for search UI. "mod" means "ctrl OR meta" so the
 * same spec works on macOS and Windows/Linux without platform detection.
 *
 * BOUNDARY: plain TypeScript — no React, no JSX. Works with any DOM
 * KeyboardEvent; the web layer decides where to attach the listener.
 */
export const SEARCH_SHORTCUTS = {
  openSearch: "mod+k",
  closeSearch: "Escape",
  focusSearch: "/",
} as const;

export type SearchShortcut = (typeof SEARCH_SHORTCUTS)[keyof typeof SEARCH_SHORTCUTS];

function matchesSpec(e: KeyboardEvent, spec: string): boolean {
  const parts = spec.split("+");
  const keySpec = parts[parts.length - 1] ?? "";
  const modifiers = new Set(parts.slice(0, -1));

  // Required modifiers must be held. "mod" is satisfied by ctrl OR meta.
  if (modifiers.has("mod") && !(e.ctrlKey || e.metaKey)) return false;
  if (modifiers.has("ctrl") && !e.ctrlKey) return false;
  if (modifiers.has("meta") && !e.metaKey) return false;
  if (modifiers.has("alt") && !e.altKey) return false;
  if (modifiers.has("shift") && !e.shiftKey) return false;

  if (e.key.toLowerCase() !== keySpec.toLowerCase()) return false;

  // Unlisted hard modifiers (ctrl/meta/alt) must be released; shift is a
  // soft modifier (caps-lock / shift-typing) and is allowed either way.
  const usesMod = modifiers.has("mod");
  const coversCtrl = modifiers.has("ctrl") || usesMod;
  const coversMeta = modifiers.has("meta") || usesMod;
  const coversAlt = modifiers.has("alt");
  if (e.ctrlKey && !coversCtrl) return false;
  if (e.metaKey && !coversMeta) return false;
  if (e.altKey && !coversAlt) return false;
  return true;
}

/**
 * True if the event matches ANY of the given shortcut specs — a single
 * spec ("mod+k") or a list (["Escape", "/"]). Spec grammar:
 * "modifier+modifier+key", where modifier is ctrl/meta/alt/shift/mod and
 * the key compares against e.key case-insensitively.
 */
export function matchesShortcut(e: KeyboardEvent, keys: string | readonly string[]): boolean {
  const specs = typeof keys === "string" ? [keys] : keys;
  return specs.some((spec) => matchesSpec(e, spec));
}
