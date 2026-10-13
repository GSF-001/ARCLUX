// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// session.ts — PlayerSession.activeMode (P1-8, 06 §2.5 dual skill).
//
// Server, bukan klien, yang menyimpan mode SHIP/FPS per pemain. Transisi
// otomatis: duduk di cockpit (dock) → ship; berdiri dari cockpit
// (spawn_character) → fps. Intent yang tidak cocok mode DITOLAK validator.

export type ActiveMode = "ship" | "fps";

export interface PlayerSession {
  playerId: string;
  activeMode: ActiveMode;
}

/** Intent yang HANYA legal di ship mode (06 §2.5: FPS skills hidden). */
export const SHIP_ONLY_INTENTS = new Set<string>([
  "attack",
  // Sprint 7 PR-A (09 §2.3): lock/unlock hanya di cockput ship.
  "lock",
  "unlock",
  // 11.2 M2 (PR-F): EW jam = combat module cockpit ship.
  "ew_jam",
  // 11.2 M4 (PR-H): salvage wreck = cockpit ship (dekat bangkai).
  "salvage",
  // 09 §3.3: point defense = turret di cockpit ship.
  "intercept",
  "activate_capability",
  "teleport",
  "scan",
  "dock",
  "spawn_station",
  "equip_component",
  "unequip_component",
  "arrest",
  "bounty_claim",
  "craft_enqueue",
  "craft_collect",
  "claim_confirm",
]);

/**
 * Intent yang HANYA legal di fps mode (skill FPS — 06 §2.3).
 * `use_skill` = skill FPS aktif (06 §2 — antrean skill queue server-side
 * lewat `skill_train`; skill FPS aktif dipakai saat fps mode).
 */
export const FPS_ONLY_INTENTS = new Set<string>([
  "use_skill",
]);

/** Intent yang legal di KEDUA mode — skill train mengikuti mode skill-nya. */
export const BOTH_MODE_INTENTS = new Set<string>([
  "skill_train",
  "skill_cancel",
]);

export function createSessionStore(initial?: Record<string, ActiveMode>) {
  const modes = new Map<string, ActiveMode>(Object.entries(initial ?? {}));

  return {
    modeOf(playerId: string): ActiveMode {
      return modes.get(playerId) ?? "ship"; // default: di cockpit (ship)
    },
    setMode(playerId: string, mode: ActiveMode): void {
      if (mode === "ship") modes.delete(playerId); // ship = default, hemat
      else modes.set(playerId, mode);
    },
    isShip(playerId: string): boolean {
      return this.modeOf(playerId) === "ship";
    },
    isFps(playerId: string): boolean {
      return this.modeOf(playerId) === "fps";
    },
    serialize(): Record<string, ActiveMode> {
      return Object.fromEntries(modes);
    },
    restore(state: Record<string, ActiveMode>): void {
      modes.clear();
      for (const [k, v] of Object.entries(state ?? {})) modes.set(k, v);
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
