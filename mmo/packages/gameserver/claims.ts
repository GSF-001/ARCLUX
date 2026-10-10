// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// claims.ts — klaim tanah: patok + sertifikat + garis pantai (P1-7, 02 §8.5/§9).
//
// Dua tier (§9.2):
//   PATOK (marking) — klaim murah sementara. Tenggat 7 hari WAJIB ada
//     bangunan berdiri (disahkan via `confirm`); kosong seminggu = HANGUS
//     otomatis kembali ke tanah negara (anti tukang kapling).
//   SERTIFIKAT — record server INVISIBLE setelah confirm (§9.1: dokumen
//    /item terlihat pemain DITOLAK — birokrasi membunuh kesenangan).
//     Mengikuti lifecycle 30 hari (lifecycle.ts).
// Pantai 10m publik (§8.6 FINAL): klaim dalam pita 10m dari garis pantai
// DITOLAK — hook `coastDistanceAt` disuntik (default tanpa data topografi
// = tidak ada pantai di region → semua titik sah sampai terrain ada).

/** Klaim standar 100×100 m (02 §8.5). */
export const CLAIM_SIZE_M = 100;
export const CLAIM_HALF_M = CLAIM_SIZE_M / 2;

/** Max petak per pemain — tunable (02 §9.4, default 3). */
export const CLAIM_MAX_PER_PLAYER = 3;

/** Patok ditanam maksimal sejauh ini dari aktor (meter). */
export const CLAIM_PLANT_RADIUS_M = 500;

/** Pita pantai publik — tak bisa diklaim (02 §8.6 FINAL). */
export const COAST_PUBLIC_BAND_M = 10;

/** Tenggat patok: 7 hari @10 tick/s — kosong = hangus otomatis (§9.2). */
export const CLAIM_PATOK_TICKS = 6_048_000;

export type ClaimTier = "patok" | "sertifikat";

export interface Claim {
  claimId: string;
  owner: string;
  centerX: number;
  centerZ: number;
  tick: number;
  tier: ClaimTier;
  /** tick patok ditanam (deadline hangus = plantedTick + CLAIM_PATOK_TICKS). */
  plantedTick: number;
}

export interface ClaimsState {
  claims: Claim[];
}

/** jarak (m) dari (x,z) ke garis pantai — disuntik dari topografi region. */
export type CoastDistanceFn = (x: number, z: number) => number;

const noCoast: CoastDistanceFn = () => Number.POSITIVE_INFINITY;

function overlaps(a: Claim, centerX: number, centerZ: number): boolean {
  return (
    Math.abs(a.centerX - centerX) < CLAIM_SIZE_M &&
    Math.abs(a.centerZ - centerZ) < CLAIM_SIZE_M
  );
}

export function createClaimStore(initial?: ClaimsState, coastDistanceAt: CoastDistanceFn = noCoast) {
  let claims: Claim[] = initial?.claims
    ? initial.claims.map((c) => ({ ...c, tier: c.tier ?? "patok", plantedTick: c.plantedTick ?? c.tick }) as Claim)
    : [];

  return {
    list(): readonly Claim[] {
      return claims;
    },
    countFor(owner: string): number {
      return claims.filter((c) => c.owner === owner).length;
    },
    overlaps(centerX: number, centerZ: number): Claim | undefined {
      return claims.find((c) => overlaps(c, centerX, centerZ));
    },
    get(claimId: string): Claim | undefined {
      return claims.find((c) => c.claimId === claimId);
    },
    add(claim: Omit<Claim, "tier" | "plantedTick">): { ok: boolean; reason?: string } {
      if (this.countFor(claim.owner) >= CLAIM_MAX_PER_PLAYER) {
        return { ok: false, reason: `anti-serakah: maks ${CLAIM_MAX_PER_PLAYER} petak per pemain (02 §9.4)` };
      }
      const clash = this.overlaps(claim.centerX, claim.centerZ);
      if (clash) return { ok: false, reason: `berimpit dengan klaim ${clash.claimId} (atau sudah diklaim)` };
      // garis pantai 10m publik — matahari terbenam tidak boleh dipagar (§8.6).
      if (coastDistanceAt(claim.centerX, claim.centerZ) < COAST_PUBLIC_BAND_M) {
        return { ok: false, reason: `pantai ${COAST_PUBLIC_BAND_M}m adalah milik publik (02 §8.6)` };
      }
      claims = [...claims, { ...claim, tier: "patok", plantedTick: claim.tick }];
      return { ok: true };
    },
    /**
     * Sahkan patok → sertifikat (ada bangunan berdiri; §9.2). Saat ini
     * dikonfirmasi pemilik yang berdiri di petaknya sendiri — verifikasi
     * posisi bangunan menyusul bersama sistem penempatan bangunan (§10).
     */
    confirm(claimId: string, actorX: number, actorZ: number, tick: number): { ok: boolean; reason?: string } {
      const c = claims.find((x) => x.claimId === claimId);
      if (!c) return { ok: false, reason: "klaim tidak ditemukan" };
      if (c.tier === "sertifikat") return { ok: false, reason: "sudah bersertifikat" };
      const inside =
        Math.abs(actorX - c.centerX) <= CLAIM_HALF_M && Math.abs(actorZ - c.centerZ) <= CLAIM_HALF_M;
      if (!inside) return { ok: false, reason: "harus berdiri di petak klaim untuk menyahkan" };
      c.tier = "sertifikat";
      c.tick = tick; // sertifikat hidup mengikuti lifecycle 30 hari dari sini
      return { ok: true };
    },
    /** Tick hook: patok kosong >7 hari hangus otomatis (§9.2 anti kapling). */
    evaluate(tick: number): Claim[] {
      const expired = claims.filter(
        (c) => c.tier === "patok" && tick - c.plantedTick >= CLAIM_PATOK_TICKS,
      );
      if (expired.length > 0) {
        const ids = new Set(expired.map((c) => c.claimId));
        claims = claims.filter((c) => !ids.has(c.claimId));
      }
      return expired;
    },
    serialize(): ClaimsState {
      return { claims: [...claims] };
    },
    restore(state: ClaimsState): void {
      claims = state?.claims
        ? state.claims.map((c) => ({ ...c, tier: c.tier ?? "patok", plantedTick: c.plantedTick ?? c.tick }) as Claim)
        : [];
    },
  };
}

export type ClaimStore = ReturnType<typeof createClaimStore>;
