// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// prison.ts — vonis penjara (05-hukum-kota §5, Sprint 5).
//
// Penangkapan (intent `arrest`, wanted ≥3 = surat terbuka) → vonis kelas
// (ringan/sedang/berat) dengan tenggat TICK. Tahanan TIDAK BISA keluar:
// validator memblokir intent keluar (telepor/dock/attack/…) sampai vonis
// selesai. NOL tombol restart (05 §5.1). Saat bebas, status wanted +
// blacklist kota DIBERSIHKAN (05 §2.6: tangkap = selesaikan status).
//
// Durasi kelas disetel playtest — default @10 tick/s:
//   ringan 5 menit · sedang 30 menit · berat 2 jam.

import type { WantedStore } from "../wanted";

export type PrisonClass = "ringan" | "sedang" | "berat";

/** Durasi vonis per kelas (tick @10/s) — tunable playtest. */
export const PRISON_SENTENCE_TICKS: Record<PrisonClass, number> = {
  ringan: 3_000, // 5 menit
  sedang: 18_000, // 30 menit
  berat: 72_000, // 2 jam
};

/** Kelas ditentukan wantedLevel saat ditangkap (05 §5.5 klasifikasi). */
export function classifyForWanted(wantedLevel: number): PrisonClass {
  if (wantedLevel >= 5) return "berat";
  if (wantedLevel >= 4) return "sedang";
  return "ringan";
}

export interface Sentence {
  playerId: string;
  klass: PrisonClass;
  /** tick server saat vonis berakhir (bebas otomatis). */
  releaseTick: number;
  arrestedBy: string;
  arrestTick: number;
  /** kota asal buronan (blacklist dibersihkan saat bebas). */
  homeCityId?: string;
}

export interface PrisonState {
  sentences: Record<string, Sentence>;
}

export function createPrisonStore(initial?: PrisonState) {
  const sentences = new Map<string, Sentence>(
    Object.entries(initial?.sentences ?? {}),
  );

  return {
    /** Vonis baru. Kalau sudah dipenjara → replace (kelasss baru, tenggat baru). */
    incarcerate(
      playerId: string,
      opts: { klass: PrisonClass; tick: number; arrestedBy: string; homeCityId?: string },
    ): Sentence {
      const sentence: Sentence = {
        playerId,
        klass: opts.klass,
        releaseTick: opts.tick + PRISON_SENTENCE_TICKS[opts.klass],
        arrestedBy: opts.arrestedBy,
        arrestTick: opts.tick,
        homeCityId: opts.homeCityId,
      };
      sentences.set(playerId, sentence);
      return sentence;
    },

    /** Vonis aktif (undefined = bebas). */
    getSentence(playerId: string): Sentence | undefined {
      const s = sentences.get(playerId);
      if (!s) return undefined;
      return s;
    },

    /** Sedang dipenjara pada tick ini? */
    isLocked(playerId: string, tick: number): boolean {
      const s = sentences.get(playerId);
      return !!s && tick < s.releaseTick;
    },

    /**
     * Tick hook: bebaskan tahanan yang tenggatnya lewat + BERSIHKAN status
     * wanted/blacklist (05 §2.6 — tangkap = selesai). Kembalikan yang bebas.
     */
    evaluate(tick: number, wanted?: WantedStore): Sentence[] {
      const freed: Sentence[] = [];
      for (const [playerId, s] of sentences) {
        if (tick >= s.releaseTick) {
          sentences.delete(playerId);
          wanted?.clear(playerId);
          freed.push(s);
        }
      }
      return freed;
    },

    /** Release dini (dibebaskan kawan / tebus) — tetap dicatat via wanted clear. */
    release(playerId: string, wanted?: WantedStore): boolean {
      const s = sentences.get(playerId);
      if (!s) return false;
      sentences.delete(playerId);
      wanted?.clear(playerId);
      return true;
    },

    count(): number {
      return sentences.size;
    },

    serialize(): PrisonState {
      return { sentences: Object.fromEntries(sentences) };
    },

    restore(state: PrisonState): void {
      sentences.clear();
      for (const [k, v] of Object.entries(state?.sentences ?? {})) sentences.set(k, v);
    },
  };
}

export type PrisonStore = ReturnType<typeof createPrisonStore>;

/** Guard util untuk validator: tahanan hanya boleh `move` (dalam zona). */
export function prisonBlocksIntent(intentType: string): boolean {
  // tahanan boleh bergerak (dalam zona penjara) + verify_hash; sisanya tidak.
  return intentType !== "move" && intentType !== "verify_hash";
}
