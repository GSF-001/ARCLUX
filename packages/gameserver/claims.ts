// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// claims.ts — klaim tanah minimum (P1-7, 02-asset-pipeline §8.5/§9).
//
// Sprint 2 hanya radius + anti-serakah (validator klaim radius):
//   - klaim standar 100×100 m (§8.5)
//   - max 3 petak per pemain, tunable (§9.4 anti-serakah)
//   - patok harus ditanam dekat aktor (radius CLAIM_PLANT_RADIUS_M)
// Lifecyle patok 7 hari + sertifikat + garis pantai = Sprint 5 (butuh
// topografi/ waktu server panjang).

/** Klaim standar 100×100 m (02 §8.5). */
export const CLAIM_SIZE_M = 100;
export const CLAIM_HALF_M = CLAIM_SIZE_M / 2;

/** Max petak per pemain — tunable (02 §9.4, default 3). */
export const CLAIM_MAX_PER_PLAYER = 3;

/** Patok ditanam maksimal sejauh ini dari aktor (meter). */
export const CLAIM_PLANT_RADIUS_M = 500;

export interface Claim {
  claimId: string;
  owner: string;
  centerX: number;
  centerZ: number;
  tick: number;
}

export interface ClaimsState {
  claims: Claim[];
}

function overlaps(a: Claim, centerX: number, centerZ: number): boolean {
  return (
    Math.abs(a.centerX - centerX) < CLAIM_SIZE_M &&
    Math.abs(a.centerZ - centerZ) < CLAIM_SIZE_M
  );
}

export function createClaimStore(initial?: ClaimsState) {
  let claims: Claim[] = initial?.claims ? [...initial.claims] : [];

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
    add(claim: Claim): { ok: boolean; reason?: string } {
      if (this.countFor(claim.owner) >= CLAIM_MAX_PER_PLAYER) {
        return { ok: false, reason: `anti-serakah: maks ${CLAIM_MAX_PER_PLAYER} petak per pemain (02 §9.4)` };
      }
      const clash = this.overlaps(claim.centerX, claim.centerZ);
      if (clash) return { ok: false, reason: `berimpit dengan klaim ${clash.claimId}` };
      claims = [...claims, claim];
      return { ok: true };
    },
    serialize(): ClaimsState {
      return { claims: [...claims] };
    },
    restore(state: ClaimsState): void {
      claims = state?.claims ? [...state.claims] : [];
    },
  };
}

export type ClaimStore = ReturnType<typeof createClaimStore>;
