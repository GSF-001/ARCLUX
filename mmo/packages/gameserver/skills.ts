// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// skills.ts — skill tree ganda ship/FPS + antrean training EVE-style (06-gameplay-systems §2).
//
// Skill ship & FPS TERPISAH (transisi mode tidak memindahkan progres).
// Training = antrean server-timestamp: 1 aktif + 3 antrean (EVE skill queue),
// selesai berdasarkan tick server (real-time), bukan klik spam. Level 0→V;
// durasi per level naik linear. Persist via serialize/restore (restart ≠
// kehilangan progres training yang sedang jalan).

export type SkillMode = "ship" | "fps";

export const SHIP_SKILLS = [
  "engine",
  "weapons",
  "shield",
  "navigation",
  "repair",
] as const;
export type ShipSkillId = (typeof SHIP_SKILLS)[number];

export const FPS_SKILLS = ["combat", "stealth", "survival", "technical"] as const;
export type FpsSkillId = (typeof FPS_SKILLS)[number];

export type SkillId = ShipSkillId | FpsSkillId;

/** Level maksimum (EVE V). */
export const SKILL_LEVEL_MAX = 5;
/** Kuota antrean: 1 aktif + 3 menunggu (06 §2 skill queue). */
export const SKILL_QUEUE_ACTIVE = 1;
export const SKILL_QUEUE_WAITING = 3;
export const SKILL_QUEUE_MAX = SKILL_QUEUE_ACTIVE + SKILL_QUEUE_WAITING;

/** Durasi level dasar (tick @10/s = 1 jam per level-1), naik linear per level. */
export const SKILL_BASE_TICKS_PER_LEVEL = 36_000;

export function skillDurationTicks(level: number): number {
  return SKILL_BASE_TICKS_PER_LEVEL * (level + 1);
}

export function isShipSkill(id: string): id is ShipSkillId {
  return (SHIP_SKILLS as readonly string[]).includes(id);
}
export function isFpsSkill(id: string): id is FpsSkillId {
  return (FPS_SKILLS as readonly string[]).includes(id);
}
export function skillModeOf(id: string): SkillMode | null {
  if (isShipSkill(id)) return "ship";
  if (isFpsSkill(id)) return "fps";
  return null;
}

export interface SkillQueueEntry {
  skillId: SkillId;
  mode: SkillMode;
  /** level yang SEDANG di-training (selesai → level+1). */
  fromLevel: number;
  endsAtTick: number;
}

export interface PlayerSkills {
  levels: Partial<Record<SkillId, number>>;
  queue: SkillQueueEntry[];
}

export interface SkillsState {
  players: Record<string, PlayerSkills>;
}

function emptyPlayer(): PlayerSkills {
  return { levels: {}, queue: [] };
}

export interface SkillTrainingEvent {
  playerId: string;
  skillId: SkillId;
  newLevel: number;
  tick: number;
}

export function createSkillStore(initial?: SkillsState) {
  const players = new Map<string, PlayerSkills>(
    Object.entries(initial?.players ?? {}).map(([k, v]) => [
      k,
      { levels: { ...v.levels }, queue: [...v.queue] },
    ]),
  );

  const getOrCreate = (playerId: string): PlayerSkills => {
    let p = players.get(playerId);
    if (!p) {
      p = emptyPlayer();
      players.set(playerId, p);
    }
    return p;
  };

  return {
    levelOf(playerId: string, skillId: SkillId): number {
      return players.get(playerId)?.levels[skillId] ?? 0;
    },

    queueOf(playerId: string): readonly SkillQueueEntry[] {
      return players.get(playerId)?.queue ?? [];
    },

    /**
     * Enqueue training satu level. Tolak kalau: skill tidak dikenal, sudah
     * max, sudah ada di antrean, atau antrean penuh. Mode skill harus cocok
     * dengan mode aktif pemain (server memegang activeMode — 06 §2.5).
     */
    train(
      playerId: string,
      skillId: string,
      activeMode: SkillMode,
      tick: number,
    ): { ok: boolean; reason?: string } {
      const mode = skillModeOf(skillId);
      if (!mode) return { ok: false, reason: "skill tidak dikenal" };
      if (mode !== activeMode) return { ok: false, reason: `skill ${skillId} hanya untuk mode ${mode}` };
      const p = getOrCreate(playerId);
      const current = p.levels[skillId as SkillId] ?? 0;
      if (current >= SKILL_LEVEL_MAX) return { ok: false, reason: "skill sudah level maksimum" };
      if (p.queue.some((q) => q.skillId === skillId)) return { ok: false, reason: "skill sudah dalam antrean" };
      if (p.queue.length >= SKILL_QUEUE_MAX) return { ok: false, reason: "antrean training penuh" };

      const last = p.queue[p.queue.length - 1];
      const fromLevel = last && last.skillId === skillId ? last.fromLevel + 1 : current;
      const base = last ? last.endsAtTick : tick;
      p.queue.push({
        skillId: skillId as SkillId,
        mode,
        fromLevel,
        endsAtTick: base + skillDurationTicks(fromLevel),
      });
      return { ok: true };
    },

    /** Batalkan satu entry antrean (EVE boleh batal — waktu hilang). */
    cancel(playerId: string, skillId: SkillId): boolean {
      const p = players.get(playerId);
      if (!p) return false;
      const idx = p.queue.findIndex((q) => q.skillId === skillId);
      if (idx < 0) return false;
      p.queue.splice(idx, 1);
      return true;
    },

    /**
     * Tick hook: selesaikan entry yang lewat tenggat, lanjutkan berikutnya.
     * Kembalikan event training yang selesai (untuk log/observability).
     */
    tick(tick: number): SkillTrainingEvent[] {
      const done: SkillTrainingEvent[] = [];
      for (const [playerId, p] of players) {
        while (p.queue.length > 0 && tick >= p.queue[0].endsAtTick) {
          const entry = p.queue.shift()!;
          const newLevel = Math.min(SKILL_LEVEL_MAX, entry.fromLevel + 1);
          p.levels[entry.skillId] = newLevel;
          done.push({ playerId, skillId: entry.skillId, newLevel, tick });
          // antrean berikutnya mulai dari tick SEKARANG (bukan endTick basi).
          const next = p.queue[0];
          if (next) next.endsAtTick = tick + skillDurationTicks(next.fromLevel);
        }
      }
      return done;
    },

    serialize(): SkillsState {
      return {
        players: Object.fromEntries(
          [...players].map(([k, v]) => [k, { levels: { ...v.levels }, queue: [...v.queue] }]),
        ),
      };
    },

    restore(state: SkillsState): void {
      players.clear();
      for (const [k, v] of Object.entries(state?.players ?? {})) {
        players.set(k, { levels: { ...v.levels }, queue: [...v.queue] });
      }
    },
  };
}

export type SkillStore = ReturnType<typeof createSkillStore>;
