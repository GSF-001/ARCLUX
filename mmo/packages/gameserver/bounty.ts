// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// bounty.ts — kontrak bounty (05-hukum-kota §6, Sprint 5).
//
// Kontrak terbuka OTOMATIS saat wanted naik ke ≥ BOUNTY_OPEN_LEVEL (§6.1).
// Hadiah diambil lewat intent `bounty_claim` — SAH hanya bila target sudah
// tumbang (vessel hilang dari region) atau dipenjara (prison.isLocked).
// Payout dari kas dunia via economy.credit (bukan dari kantong pelaku).
// Level 5 = hadiah 2× (§6.2 eskalasi mengikuti kelas tahanan — tabel).

import type { Economy } from "../economy";

/** Kontrak terbuka mulai wanted level ini (§6.1). */
export const BOUNTY_OPEN_LEVEL = 4;

/** Hadiah dasar (OC) per kontrak — tunable playtest. */
export const BOUNTY_BASE_REWARD = 5_000;

export type BountyStateKind = "open" | "claimed";

export interface BountyContract {
  bountyId: string;
  targetId: string;
  rewardOc: number;
  state: BountyStateKind;
  openedTick: number;
  claimedBy?: string;
  claimedTick?: number;
}

export interface BountyStoreState {
  contracts: Record<string, BountyContract>;
}

let bountySeq = 0;

export function createBountyStore(initial?: BountyStoreState) {
  const contracts = new Map<string, BountyContract>(
    Object.entries(initial?.contracts ?? {}),
  );

  const openForTarget = (targetId: string, wantedLevel: number, tick: number): BountyContract | undefined => {
    if (wantedLevel < BOUNTY_OPEN_LEVEL) return undefined;
    // satu kontrak terbuka per target (spam Escalation tidak melipatgandakan).
    for (const c of contracts.values()) {
      if (c.targetId === targetId && c.state === "open") return c;
    }
    const bountyId = `bounty-${targetId}-${++bountySeq}`;
    // hadiah mengikuti kelas: level 5 = 2× (§6.2 tabel, bukan GM).
    const rewardOc = wantedLevel >= 5 ? BOUNTY_BASE_REWARD * 2 : BOUNTY_BASE_REWARD;
    const contract: BountyContract = { bountyId, targetId, rewardOc, state: "open", openedTick: tick };
    contracts.set(bountyId, contract);
    return contract;
  };

  return {
    openForTarget,

    get(bountyId: string): BountyContract | undefined {
      return contracts.get(bountyId);
    },

    openContracts(): BountyContract[] {
      return [...contracts.values()].filter((c) => c.state === "open");
    },

    /**
     * Tebus hadiah. `targetNeutral` = target tumbang (vessel hilang) ATAU
     * dipenjara — pelaku TIDAK boleh mengklaim dirinya sendiri.
     */
    claim(
      bountyId: string,
      claimerId: string,
      tick: number,
      targetNeutral: boolean,
      economy?: Economy,
    ): { ok: boolean; reason?: string; rewardOc?: number } {
      const c = contracts.get(bountyId);
      if (!c) return { ok: false, reason: "kontrak tidak ditemukan" };
      if (c.state !== "open") return { ok: false, reason: "kontrak sudah diklaim" };
      if (c.targetId === claimerId) return { ok: false, reason: "tidak boleh mengklaim kontrak sendiri" };
      if (!targetNeutral) return { ok: false, reason: "target belum tumbang/dipenjara" };
      c.state = "claimed";
      c.claimedBy = claimerId;
      c.claimedTick = tick;
      economy?.credit(claimerId, c.rewardOc, tick);
      return { ok: true, rewardOc: c.rewardOc };
    },

    serialize(): BountyStoreState {
      return { contracts: Object.fromEntries(contracts) };
    },

    restore(state: BountyStoreState): void {
      contracts.clear();
      for (const [k, v] of Object.entries(state?.contracts ?? {})) contracts.set(k, v);
    },
  };
}

export type BountyStore = ReturnType<typeof createBountyStore>;
