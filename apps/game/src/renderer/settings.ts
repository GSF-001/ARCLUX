// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/settings.ts — graphig settings engine (blueprint 01 §22 LOD,
// §28 command-interface). Desktop MMORPG tiers: LOW/MEDIUM/HIGH/ULTRA/CINEMATIC.
// FPS cap 30-240/∞; render resolution scale; bloom; nebula/star/planet density.
// Persist ke localStorage per region session (D-008: visual hanya client-side,
// authoritative tetap server).

export type QualityPreset = "LOW" | "MEDIUM" | "HIGH" | "ULTRA" | "CINEMATIC";
export type FpsCap = 30 | 60 | 90 | 120 | 240 | 0; // 0 = uncapped
export type BloomQuality = "off" | "low" | "high";

export interface GameSettings {
  preset: QualityPreset;
  fpsCap: FpsCap;
  resolutionScale: number; // 0.5..2.0
  pixelRatio: number; // 1 | 2 | 3 (kap per-DPR)
  antialias: boolean;
  bloom: BloomQuality;
  shadowQuality: "off" | "low" | "medium" | "high";
  nebulaDensity: number; // 0..12
  starBodies: number; // 0..3 (binary/trinary)
  planetCount: number; // 6..12
  planetDetail: number; // 16..96 (segments)
  beltDensity: number; // 0..10000 asteroids
  vesselDetail: number; // 1..3 (LOD §22)
  toneMapping: "ACES" | "AGX" | "REINHARD";

  // Audio (audio.ts konsumen)
  masterVolume: number; // 0..1
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;

  // Controls (§6)
  keyForward: string;
  keyReverse: string;
  keyStrafeLeft: string;
  keyStrafeRight: string;
  keyUp: string;
  keyDown: string;
  keyBoost: string;
  keyBrake: string;
  keyLook: string; // "mouse" | "pointer-lock"
  invertLookY: boolean;
  lookSensitivity: number; // 0.1..2.0
}

const DEFAULT_KEY = {
  forward: "KeyW",
  reverse: "KeyS",
  strafeLeft: "KeyA",
  strafeRight: "KeyD",
  up: "KeyQ",
  down: "KeyE",
  boost: "ShiftLeft",
  brake: "Space",
  look: "mouse",
} as const;

export function defaultSettings(): GameSettings {
  return {
    preset: "ULTRA",
    fpsCap: 120,
    resolutionScale: 1,
    pixelRatio: 2,
    antialias: true,
    bloom: "high",
    shadowQuality: "high",
    nebulaDensity: 12,
    starBodies: 3,
    planetCount: 12,
    planetDetail: 48,
    beltDensity: 8000,
    vesselDetail: 3,
    toneMapping: "ACES",

    masterVolume: 0.85,
    sfxVolume: 0.7,
    musicVolume: 0.5,
    muted: false,

    keyForward: DEFAULT_KEY.forward,
    keyReverse: DEFAULT_KEY.reverse,
    keyStrafeLeft: DEFAULT_KEY.strafeLeft,
    keyStrafeRight: DEFAULT_KEY.strafeRight,
    keyUp: DEFAULT_KEY.up,
    keyDown: DEFAULT_KEY.down,
    keyBoost: DEFAULT_KEY.boost,
    keyBrake: DEFAULT_KEY.brake,
    keyLook: DEFAULT_KEY.look,
    invertLookY: false,
    lookSensitivity: 0.6,
  };
}

const PRESETS: Record<QualityPreset, () => Partial<GameSettings>> = {
  // Mobile-ish fallback tidak disediakan: ARCLUX desktop MMORPG (§28).
  // LOW = netbook/iGPU sekelas, bukan cellphone.
  LOW: () => ({
    fpsCap: 60,
    resolutionScale: 0.6,
    pixelRatio: 1,
    antialias: false,
    bloom: "off",
    shadowQuality: "off",
    nebulaDensity: 3,
    starBodies: 1,
    planetCount: 6,
    planetDetail: 16,
    beltDensity: 2000,
    vesselDetail: 1,
    toneMapping: "REINHARD",
  }),
  MEDIUM: () => ({
    fpsCap: 60,
    resolutionScale: 0.75,
    pixelRatio: 1,
    antialias: true,
    bloom: "low",
    shadowQuality: "low",
    nebulaDensity: 6,
    starBodies: 2,
    planetCount: 8,
    planetDetail: 24,
    beltDensity: 4000,
    vesselDetail: 2,
    toneMapping: "ACES",
  }),
  HIGH: () => ({
    fpsCap: 120,
    resolutionScale: 1,
    pixelRatio: 2,
    antialias: true,
    bloom: "high",
    shadowQuality: "medium",
    nebulaDensity: 9,
    starBodies: 3,
    planetCount: 10,
    planetDetail: 32,
    beltDensity: 6000,
    vesselDetail: 3,
    toneMapping: "ACES",
  }),
  ULTRA: () => ({
    ...defaultSettings(),
  }),
  CINEMATIC: () => ({
    fpsCap: 240,
    resolutionScale: 1.5,
    pixelRatio: 3,
    antialias: true,
    bloom: "high",
    shadowQuality: "high",
    nebulaDensity: 12,
    starBodies: 3,
    planetCount: 12,
    planetDetail: 64,
    beltDensity: 10000,
    vesselDetail: 3,
    toneMapping: "AGX",
  }),
};

const STORAGE_KEY = "arclux.game.settings.v1";

export function loadSettings(): GameSettings {
  const base = defaultSettings();
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function applyPreset(preset: QualityPreset): GameSettings {
  const fresh = defaultSettings();
  const p = PRESETS[preset];
  if (!p) return fresh;
  const merged = { ...fresh, ...p() };
  // Preset tidak menyentuh audio & controls (kategori terpisah).
  const cur = loadSettings();
  merged.masterVolume = cur.masterVolume;
  merged.sfxVolume = cur.sfxVolume;
  merged.musicVolume = cur.musicVolume;
  merged.muted = cur.muted;
  merged.keyForward = cur.keyForward;
  merged.keyReverse = cur.keyReverse;
  merged.keyStrafeLeft = cur.keyStrafeLeft;
  merged.keyStrafeRight = cur.keyStrafeRight;
  merged.keyUp = cur.keyUp;
  merged.keyDown = cur.keyDown;
  merged.keyBoost = cur.keyBoost;
  merged.keyBrake = cur.keyBrake;
  merged.keyLook = cur.keyLook;
  merged.invertLookY = cur.invertLookY;
  merged.lookSensitivity = cur.lookSensitivity;
  merged.preset = preset;
  return merged;
}

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const next = { ...loadSettings(), ...patch };
  saveSettings(next);
  return next;
}

export function effPixelRatio(s: GameSettings, dpr: number): number {
  const cap = s.pixelRatio;
  return Math.min(Math.max(cap, 1), Math.min(dpr, 3));
}