// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// crafting.ts — antrean rakit berbasis SERVER timestamp (02-asset-pipeline §3).
//
// Rakit dikirim ke server → masuk antrean dengan tenggat TICK server
// (bukan waktu klien). Durasi mengikuti KELAS kerajinan: menit (small) →
// jam (structure) → belasan jam (large) → hari (capital). 1 slot rakit
// dasar + 1 slot veteran (owner capital structure). Spam percuma: queue
// menumpuk, selesai tetap secepat durasi kelas — bukan secepat klik.

export type CraftClass = "small" | "structure" | "large" | "capital";

/** Durasi kelas (tick @10/s): small 1m · structure 1h · large 12h · capital 3 hari. */
export const CRAFT_CLASS_TICKS: Record<CraftClass, number> = {
  small: 600, // 1 menit
  structure: 36_000, // 1 jam
  large: 432_000, // 12 jam
  capital: 2_592_000, // 3 hari
};

export type CraftStateKind = "queued" | "running" | "done";

export interface CraftJob {
  craftId: string;
  playerId: string;
  blueprintId: string;
  klass: CraftClass;
  state: CraftStateKind;
  queuedTick: number;
  /** hanya relevan saat running. */
  endsAtTick?: number;
  doneTick?: number;
}

export interface CraftingState {
  jobs: Record<string, CraftJob>;
  /** pemain dengan slot veteran (1 slot ekstra). */
  veterans: string[];
}

let craftSeq = 0;

const MAX_QUEUE_PER_PLAYER = 20; // batas antrean per pemain (memori, bukan paywall)

export function createCraftingStore(initial?: CraftingState) {
  const jobs = new Map<string, CraftJob>(
    Object.entries(initial?.jobs ?? {}).map(([k, v]) => [k, { ...v }]),
  );
  const veterans = new Set<string>(initial?.veterans ?? []);

  const slotsOf = (playerId: string): number => (veterans.has(playerId) ? 2 : 1);

  const promote = (playerId: string, tick: number): void => {
    // pindahkan queued → running selama slot tersedia.
    const mine = [...jobs.values()]
      .filter((j) => j.playerId === playerId)
      .sort((a, b) => a.queuedTick - b.queuedTick);
    let running = mine.filter((j) => j.state === "running").length;
    for (const j of mine) {
      if (running >= slotsOf(playerId)) break;
      if (j.state === "queued") {
        j.state = "running";
        j.endsAtTick = tick + CRAFT_CLASS_TICKS[j.klass];
        running++;
      }
    }
  };

  return {
    grantVeteranSlot(playerId: string): void {
      veterans.add(playerId);
    },
    hasVeteranSlot(playerId: string): boolean {
      return veterans.has(playerId);
    },
    slotsOf,

    /** Enqueue satu kerajinan. Spam menumpuk di antrean — tak mempercepat apa pun. */
    enqueue(
      playerId: string,
      blueprintId: string,
      klass: CraftClass,
      tick: number,
    ): { ok: boolean; reason?: string; craftId?: string } {
      if (!CRAFT_CLASS_TICKS[klass]) return { ok: false, reason: "kelas kerajinan tidak dikenal" };
      const mine = [...jobs.values()].filter(
        (j) => j.playerId === playerId && (j.state === "queued" || j.state === "running"),
      );
      if (mine.length >= MAX_QUEUE_PER_PLAYER) {
        return { ok: false, reason: "antrean rakit penuh" };
      }
      const craftId = `craft-${playerId}-${++craftSeq}`;
      const job: CraftJob = {
        craftId,
        playerId,
        blueprintId,
        klass,
        state: "queued",
        queuedTick: tick,
      };
      jobs.set(craftId, job);
      promote(playerId, tick);
      return { ok: true, craftId };
    },

    jobsOf(playerId: string): CraftJob[] {
      return [...jobs.values()].filter((j) => j.playerId === playerId);
    },

    get(craftId: string): CraftJob | undefined {
      return jobs.get(craftId);
    },

    /** Ambil hasil yang selesai (done → dihapus dari antrean; event konsumsi klien). */
    collect(craftId: string, playerId: string): { ok: boolean; reason?: string; job?: CraftJob } {
      const j = jobs.get(craftId);
      if (!j || j.playerId !== playerId) return { ok: false, reason: "pekerjaan tidak ditemukan" };
      if (j.state !== "done") return { ok: false, reason: "belum selesai" };
      jobs.delete(craftId);
      return { ok: true, job: j };
    },

    /** Tick hook: selesaikan yang lewat tenggat + promosi antrean berikutnya. */
    tick(tick: number): CraftJob[] {
      const completed: CraftJob[] = [];
      for (const j of jobs.values()) {
        if (j.state === "running" && j.endsAtTick !== undefined && tick >= j.endsAtTick) {
          j.state = "done";
          j.doneTick = tick;
          completed.push(j);
        }
      }
      const touched = new Set(completed.map((j) => j.playerId));
      for (const playerId of touched) promote(playerId, tick);
      return completed;
    },

    serialize(): CraftingState {
      return {
        jobs: Object.fromEntries([...jobs].map(([k, v]) => [k, { ...v }])),
        veterans: [...veterans],
      };
    },

    restore(state: CraftingState): void {
      jobs.clear();
      for (const [k, v] of Object.entries(state?.jobs ?? {})) jobs.set(k, { ...v });
      veterans.clear();
      for (const v of state?.veterans ?? []) veterans.add(v);
    },
  };
}

export type CraftingStore = ReturnType<typeof createCraftingStore>;
