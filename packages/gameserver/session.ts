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
  "activate_capability",
  "teleport",
  "scan",
  "dock",
  "spawn_station",
  "equip_component",
  "unequip_component",
]);

/** Intent yang HANYA legal di fps mode (skill FPS — 06 §2.3). */
export const FPS_ONLY_INTENTS = new Set<string>([
  "use_skill", // skill FPS (belum diimplement; gate-nya sudah ada di sini)
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
