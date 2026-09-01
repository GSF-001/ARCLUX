// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/ui/tokens.ts — Bahasa visual ARCLUX MMO (game-native, TERPISAH dari apps/web).
// "The repository is a vessel; ARCLUX gives it form. The universe gives it history."
// Permutations: satu Ark-Librarieschip vessel-world — repository jadi distrik,
// community jadi fraksi, pilot jadi karakter persisten. Perjuangan perjuangan
// menghasilkan sejarah. EVE-industrial (§01 §28), bukan web dashboard.
//
// Tujuan: SATU sumber warna/typografi/spacing/glow — dipakai HUD (string hex CSS)
// dan renderer (int 0x for THREE). Tidak ada duplikasi nilai lintas file.
// Design di B-Z, bukan tiruan `/apps/web` (MMO punya identitasnya sendiri).

// ---------------------------------------------------------------------------
// PALET — berakar lore/fisika gam, bukan tailwind.
// RUANG = deep void; EMISSIVE = teknologi mati/taktis; FRAKSI = identitas sosial.
// ---------------------------------------------------------------------------
export const colors = {
  // Ruang & struktur (01 §2.5 dua skala: system/lokal)
  void: "#02030a",
  voidDeep: "#04060d",
  struct: "#1a2436", // panel/jurang struktur
  structHigh: "#2c3a55", // jurang terang / slot
  edge: "#3a4a6a", // garis batas taktis

  // Teks & lapisan data
  foreground: "#c9d6ff", // teks utama
  body: "#9fb2d8", // body data
  muted: "#5a6e92", // label redup
  empty: "#31405c", // no-contacts / kosong

  // Teknologi / sinyal (system OK, engine, telemetri)
  tech: "#52c8ff", // cyan — engine/signal/active
  techDim: "#2a6a9a",
  // Taktis / perhatian (target, slot, alert, scanline)
  tactical: "#ffb36b", // amber taktis
  tacticalDim: "#8a5a2e",
  // Status fisik (derivasi physics/combat — bukan web semantic colors)
  ok: "#5fe0a0", // sistem baik
  warn: "#f5a742", // cooldown / dekat batas
  danger: "#ff5a5f", // damage / overheat / melt
  deplete: "#8a5a2e", // depleted / material limit

  // Fraksi — identitas sosial (06 §18.6/18.8). NEUTRAL default.
  factionA: "#7d5cff", // violet — fraksi utama
  factionB: "#ff7d5c", // ember — fraksi oposisi
  neutral: "#8f9bb3",

  // Kosmik (02 §2.6 fisika: sun emissive ∝ aktivitas, planet termal)
  sun: "#ffcf8a",
  sunEmissive: "#ffb36b",
  sunCore: "#fff2dd",
  planetBlue: "#4a6fa5",
  planetVolcanic: "#b5673b",
  planetVolcanicGlow: "#441100",
  planetGreen: "#2c5f5a",
  belt: "#555a70",
  hotStarA: "#9fd8ff",
  hotStarB: "#ffd9a0",
  hotStarC: "#ffb3c1",

  // Vessel & station
  hull: "#2b3a55",
  hullHigh: "#1f2a42",
  stationHub: "#335a7a",
  stationRing: "#2b4a66",

  // Glow (scene — additive)
  glowEngine: "#4cc9ff",
  glowShield: "#3aa0ff",
  glowStation: "#67e8f9",
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAFI — mono utama + display taktis. Self-hosted (CSP `default-src 'self'`):
// @font-face dipasang HUD; nilai di sini jadi kontrak, bukan hardcode tiap file.
// ---------------------------------------------------------------------------
export const typography = {
  mono: "'JetBrains Mono', ui-monospace, monospace",
  display: "'Orbitron', 'JetBrains Mono', monospace",
  sizes: {
    micro: "9px",
    data: "11px",
    label: "12px",
    title: "15px",
    display: "22px",
  },
  letterspacing: "0.5px",
  displaySpacing: "2px",
} as const;

// ---------------------------------------------------------------------------
// SPACING & LAYERING
// ---------------------------------------------------------------------------
export const spacing = {
  inset: "16px",
  panelWidthLeft: "240px",
  panelWidthRight: "252px",
  gapSlot: "10px",
  slotPad: "5px 12px",
} as const;

// ---------------------------------------------------------------------------
// GLOW — cinematic depth (§28) bukan flat web
// ---------------------------------------------------------------------------
export const glow = {
  textTech: "0 0 6px rgba(82,200,255,0.35)",
  textTactical: "0 0 6px rgba(255,179,107,0.4)",
  panelBg: "rgba(10,16,28,0.55)",
  frameGradient: "rgba(82,140,255,0.12)",
  scanline: "rgba(255,179,107,0.08)",
} as const;

// ---------------------------------------------------------------------------
// KONVERTER — satu sumber → dua bentuk
// ---------------------------------------------------------------------------
/** Hex string untuk CSS/HTML: `css(colors.tech)` → `#52c8ff`. */
export function hex(c: string): string {
  return c;
}

/** Integer untuk THREE color: `threeColor(colors.tech)` → `0x52c8ff`. */
export function threeColor(c: string): number {
  return parseInt(c.replace("#", ""), 16);
}

export const nebulaSeed = 0x5eed;

export type Tokens = {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  glow: typeof glow;
};
export const tokens: Tokens = { colors, typography, spacing, glow };