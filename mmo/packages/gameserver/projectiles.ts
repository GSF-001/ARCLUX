// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// projectiles.ts — projectile server-side (09-combat-depth §3).
//
// Missile/torpedo BUKAN hitscan: entity terbang server-side dengan homing
// turn-rate (bisa dielak — inspirasi RInterpTo Missle.cpp, dinormalkan ke
// fraction), arm time 2 tick, TTL fizzle, cap per-region. Determinisme
// penuh: iterasi insertion-order, tanpa Math.random (intercept roll =
// createSeedRng hash owner|projectile|tick).

import type { ProjectileEntity, VesselEntity, Vec3 } from "./types";
import type { WorldRegion } from "./world";
import { applyWeaponDamage, DAMAGE_CEILING } from "./combat";
import { createSeedRng } from "./random";
import { angleToPosDeg, LOCK_CONE_DEG } from "./targeting";

// ── Weapon definitions (§3.4 balance table) ──────────────────────────────

export interface WeaponDef {
  id: string;
  /** Unit/tick (mis. 60 = 600u/s @10Hz). */
  speed: number;
  /** Fraction lerp arah per tick — makin kecil makin gampang dielak. */
  turnRate: number;
  /** Base damage SEBELUM pipeline (§5) — preview client; resolusi tetap applyWeaponDamage. */
  baseDamage: number;
  /** Max range untuk mod rangeFalloff (09 §5.2) + validator.
   * Literal 5000 (bukan import stats::DEFAULT_WEAPON_RANGE_M) — hindari
   * cycle ESM stats↔projectiles (child tsx crash: TDZ). */
  maxRange: number;
  ttlTicks: number;
  cooldownTicks: number;
  armTicks: number;
  /** true = spawn projectile entity; false/tidak ada = hitscan instan. */
  projectile: boolean;
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  "weapon.missile": {
    id: "weapon.missile", speed: 60, turnRate: 0.12, baseDamage: 10,
    ttlTicks: 50, cooldownTicks: 6, armTicks: 2, projectile: true,
    maxRange: 5000,
  },
  "weapon.torpedo": {
    id: "weapon.torpedo", speed: 35, turnRate: 0.07, baseDamage: DAMAGE_CEILING,
    ttlTicks: 80, cooldownTicks: 12, armTicks: 2, projectile: true,
    maxRange: 5000,
  },
  "weapon.rocket": {
    id: "weapon.rocket", speed: 90, turnRate: 0.05, baseDamage: 6,
    ttlTicks: 30, cooldownTicks: 3, armTicks: 2, projectile: true,
    maxRange: 5000,
  },
};

export function weaponDefOf(weaponType: string): WeaponDef | undefined {
  return WEAPON_DEFS[weaponType];
}

/** Kapasitas projectile per region — satu sumber dengan stability trim. */
export const MAX_PROJECTILES_PER_REGION = 100;

/** Hit radius closest-approach (meter). */
export const HIT_RADIUS_M = 25;

/** Point defense (§3.3): chance = clamp(base − speed/1000, min, max). */
export const PD_BASE_TRACKING = 0.75;
export const PD_MIN_CHANCE = 0.15;
export const PD_MAX_CHANCE = 0.85;
export const INTERCEPT_RANGE_M = 5000;
export const INTERCEPT_COOLDOWN_TICKS = 4;
export const INTERCEPT_COOLDOWN_KEY = "weapon.intercept";

// ── Util deterministik ───────────────────────────────────────────────────

/** FNV-1a 32-bit — id projectile + seed intercept roll. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len === 0) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Homing step (§3.2.1b): linear-lerp antara arah sekarang dan desired
 * (VInterpTo-style). Sengaja TIDAK di-normalize per tick:
 *   1. Normalize per-tick mengembalikan |dir| ke 1 tiap langkah — lerp
 *      antara +Z dan −Z selalu hasilkan +Z·0.76 → norm +Z → STUCK forward
 *      (bug nyata sebelum fix ini — missile tak pernah berbalik).
 *   2. |dir| ≤ 1 (convex combo dua unit vector) = turning bleed speed —
 *      missile melambat saat berbelok, kapal transversal lebih mungkin
 *      dodge (mendekati perilaku RInterpTo).
 *   3. Tanpa acos = determinisme lintas platform (lihat random.ts).
 */
function homingDir(dir: Vec3, desired: Vec3, turnRate: number): Vec3 {
  return {
    x: dir.x + (desired.x - dir.x) * turnRate,
    y: dir.y + (desired.y - dir.y) * turnRate,
    z: dir.z + (desired.z - dir.z) * turnRate,
  };
}

/** Jarak titik `p` ke segmen `a→b` (closest-approach anti-tunnelling). */
function segmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t), p.z - (a.z + abz * t));
}

// ── Spawn (§3.3) ─────────────────────────────────────────────────────────

/** prj:<fnv1a(owner|weapon|tick|seq)> — unik per tembakan. */
export function projectileIdOf(ownerId: string, weaponType: string, tick: number, seq: number): string {
  return `prj:${fnv1a(`${ownerId}|${weaponType}|${tick}|${seq}`).toString(36)}`;
}

/**
 * Spawn projectile dari posisi penembak menuju target. Return undefined
 * kalau region penuh (caller menolak + event — pola entity cap).
 */
export function spawnProjectile(
  region: WorldRegion,
  ownerId: string,
  weaponType: string,
  targetId: string,
  tick: number,
  seq: number
): ProjectileEntity | undefined {
  if (region.projectiles.length >= MAX_PROJECTILES_PER_REGION) return undefined;
  const owner = region.get(ownerId);
  const target = region.get(targetId);
  if (!owner || !target) return undefined;
  const def = weaponDefOf(weaponType);
  if (!def?.projectile) return undefined;

  const dir = normalize({
    x: target.position.x - owner.position.x,
    y: target.position.y - owner.position.y,
    z: target.position.z - owner.position.z,
  });
  const proj: ProjectileEntity = {
    id: projectileIdOf(ownerId, weaponType, tick, seq),
    ownerId,
    weaponType,
    targetId,
    pos: { x: round2(owner.position.x), y: round2(owner.position.y), z: round2(owner.position.z) },
    dir,
    speed: def.speed,
    turnRate: def.turnRate,
    damage: def.baseDamage,
    ttlTicks: def.ttlTicks,
    armTicks: def.armTicks,
  };
  region.projectiles.push(proj);
  return proj;
}

// ── Per-tick step (§3.2) ─────────────────────────────────────────────────

export interface ProjectileEvent {
  type: "projectile_hit" | "projectile_fizzle";
  projectileId: string;
  ownerId: string;
  targetId: string;
  weaponType: string;
  meta?: Record<string, unknown>;
}

/**
 * Langkah projectile: homing → move → hit resolution (closest-approach
 * segment, arm habis) → TTL fizzle. Iterasi insertion-order; array rebuild
 * tiap tick (survivors). Urutan sim: intents → locks → PROJECTILES → physics.
 */
export function stepProjectiles(
  region: WorldRegion,
  logger?: (event: ProjectileEvent, attacker?: VesselEntity) => void
): void {
  if (region.projectiles.length === 0) return;
  const survivors: ProjectileEntity[] = [];

  for (const proj of region.projectiles) {
    const target = region.get(proj.targetId);
    // Target mati/hilang → inert fly-by ke arah terakhir (TTL tetap jalan).
    if (target) {
      const desired = normalize({
        x: target.position.x - proj.pos.x,
        y: target.position.y - proj.pos.y,
        z: target.position.z - proj.pos.z,
      });
      proj.dir = homingDir(proj.dir, desired, proj.turnRate);
    }

    const prev = { ...proj.pos };
    proj.pos = {
      x: round2(proj.pos.x + proj.dir.x * proj.speed),
      y: round2(proj.pos.y + proj.dir.y * proj.speed),
      z: round2(proj.pos.z + proj.dir.z * proj.speed),
    };
    if (proj.armTicks > 0) proj.armTicks -= 1;
    proj.ttlTicks -= 1;

    // Hit resolution: closest-approach segmen + arm habis (§3.2.2).
    // Segment (bukan titik akhir) = anti-tunnelling; point-blank tetap
    // kena saat arm habis pada putaran homing berikutnya (bukan self-fizzle).
    if (target && target.kind === "vessel" && proj.armTicks <= 0) {
      const d = segmentDistance(target.position, prev, proj.pos);
      if (d <= HIT_RADIUS_M) {
        const attacker = region.get(proj.ownerId);
        const owner = attacker && attacker.kind === "vessel" ? attacker : undefined;
        // applyWeaponDamage TANPA logger internal — event projectile_hit
        // (dengan meta impact) di-log satu kali di bawah (jangan dobel).
        // ctx distance = jarak projectile→target saat hit (≤ HIT_RADIUS_M,
        // hampir selalu di sweet-spot falloff).
        const dist = Math.hypot(
          proj.pos.x - target.position.x,
          proj.pos.y - target.position.y,
          proj.pos.z - target.position.z
        );
        const impact = owner ? applyWeaponDamage(owner, target, proj.weaponType, undefined, { distance: dist }) : undefined;
        if (impact) {
          logger?.({
            type: "projectile_hit",
            projectileId: proj.id,
            ownerId: proj.ownerId,
            targetId: target.id,
            weaponType: proj.weaponType,
            meta: {
              attackerId: owner?.id,
              subsystemId: impact.subsystemId,
              damage: impact.damage,
              destroyed: impact.destroyed,
              resisted: impact.resisted,
            },
          }, owner);
          continue; // meledak — tidak survivor
        }
      }
    }

    if (proj.ttlTicks <= 0) {
      logger?.({
        type: "projectile_fizzle",
        projectileId: proj.id,
        ownerId: proj.ownerId,
        targetId: proj.targetId,
        weaponType: proj.weaponType,
      });
      continue;
    }
    survivors.push(proj);
  }

  region.projectiles = survivors;
}

// ── Point defense (§3.3) ─────────────────────────────────────────────────

/**
 * Intercept: turret menembak peluru masuk. Syarat: peluru dalam
 * `INTERCEPT_RANGE_M` + cone 45° (heading kapal). Roll deterministik:
 * `createSeedRng(fnv1a(owner|projectile|tick))` — bukan Math.random.
 * Sukses → peluru hilang SEBELUM hit resolution tick berjalan.
 */
export function interceptProjectile(
  region: WorldRegion,
  shooter: VesselEntity,
  projectileId: string,
  tick: number
): boolean {
  const idx = region.projectiles.findIndex((p) => p.id === projectileId);
  if (idx === -1) return false;
  const proj = region.projectiles[idx];

  const dx = proj.pos.x - shooter.position.x;
  const dy = proj.pos.y - shooter.position.y;
  const dz = proj.pos.z - shooter.position.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > INTERCEPT_RANGE_M || dist === 0) return false;

  // Cone 45° — satu sumber dgn lock cone (angleToPosDeg dari targeting).
  if (angleToPosDeg(shooter, proj.pos) > LOCK_CONE_DEG) return false;

  const chance = Math.max(PD_MIN_CHANCE, Math.min(PD_MAX_CHANCE, PD_BASE_TRACKING - proj.speed / 1000));
  const rng = createSeedRng(fnv1a(`${shooter.id}|${projectileId}|${tick}`));
  if (!rng.chance(chance)) return false;

  region.projectiles.splice(idx, 1);
  return true;
}
