// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Damage pipeline — accessors terpusat (09-combat-depth §5).
//
// Versi TS dari AttributeSet_Base: satu tempat angka dicari, konsisten
// untuk kapal pemain, NPC, dan (Sprint 5) karakter FPS. Semua DERIVED
// dari data vessel yang sudah ada — tanpa state baru. Capture
// SourceAttackPower / TargetDefensePower ala GEExeCalc_DamageTaken.

import type { VesselEntity, WorldEntity } from "./types";
import { hullOf } from "./vesselState";
import { WEAPON_DEFS } from "./projectiles";

/** Headroom attack — mod (booster/skill) menambah di atas health weapons. */
export const ATTACK_POWER_MAX = 150;
export const DEFENSE_POWER_MAX = 150;

/** Range turret hitscan default — satu sumber dengan validator. */
export const DEFAULT_WEAPON_RANGE_M = 5000;

/** 0..150 — health subsystem weapons (headroom mod di atas 100). */
export function attackPowerOf(v: VesselEntity): number {
  const weapons = v.vessel.systems.find((s) => s.id === "weapons")?.health ?? 0;
  return Math.max(0, Math.min(ATTACK_POWER_MAX, weapons));
}

/** 0..150 — (hull ratio + defense health) / 2. */
export function defensePowerOf(v: VesselEntity): number {
  const defense = v.vessel.systems.find((s) => s.id === "defense")?.health ?? 0;
  const power = (hullOf(v.vessel) + defense) / 2;
  return Math.max(0, Math.min(DEFENSE_POWER_MAX, power));
}

/** Signature target — proxy massa/kelas dari integrity (0..100) — faktor
 * lock & splash (09 §5.1). Satu sumber untuk targeting + pipeline. */
export function signatureOf(target: WorldEntity): number {
  if (target.kind !== "vessel") return 50;
  return Math.max(0, Math.min(100, target.vessel.integrity));
}

/** Max range senjata — WEAPON_DEFS (projectile) atau default turret. */
export function weaponRangeOf(weaponType: string): number {
  return WEAPON_DEFS[weaponType]?.maxRange ?? DEFAULT_WEAPON_RANGE_M;
}

/** Mod hook 1 (urutan tetap, murni): linear 100%→60% dari 0 ke maxRange. */
export function rangeFalloffOf(distance: number, maxRange: number): number {
  const d = Math.max(0, Math.min(distance, maxRange));
  return 1 - 0.4 * (d / maxRange);
}

/** Mod hook 2: kapal rusak = sakit menembak — weapons health < 50 → ×0.7. */
export function conditionPenaltyOf(attacker: VesselEntity): number {
  const weapons = attacker.vessel.systems.find((s) => s.id === "weapons")?.health ?? 0;
  return weapons < 50 ? 0.7 : 1;
}
