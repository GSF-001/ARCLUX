// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// vehicle.ts — Vehicle archetype system (ARCLUX MMO).
//
// Setiap kendaraan (tank, helikopter, kapsul, mobil, drone) dipasangkan
// dengan satu VehicleArchetype yang menentukan:
//   - movementType (roda / track / rotor / thruster 6DoF / hover) → UE5 Movement Component yang dipakai
//   - weaponSlots (slot + WeaponDef per slot) → senjata berbeda-beda per kendaraan
//   - skills (skillId + cooldown) → consumable/ability per kendaraan
//   - cameraPreset + hudLayout → kamera + konsol UI yang berubah saat naik kendaraan
//   - maxSpeed, turnRate, hull, shield → stat fisika server-authoritative
//
// Semua angka di sini DIPAKAI SERVER (simulasi). UE5 hanya membaca archetype
// ini via snapshot untuk menampilkan model aset kamu dengan movement component
// yang cocok. Model 3D asli tetap tinggal di gudang aset kamu (ARCLUX-assets).

import type { WeaponDef } from "./projectiles";
import type { VesselEntity } from "./types";

// ── Movement types (mirror 1:1 ke UE5 Movement Component) ──────────────────

export type VehicleMovementType =
  | "wheeled"      // mobil: roda + suspensi + kemudi
  | "tracked"      // tank: track rantai + turret berputar independen
  | "rotorcraft"   // helikopter: rotor utama + tail + collective/cyclic
  | "thruster6dof" // kapsul luar angkasa: thruster enam arah, pitch/yaw/roll
  | "hover";       // kendaraan melayang: anti-grav + lateral

export type VehicleKind = "spacecraft" | "ground" | "air";

// ── Weapon slot (senjata terpasang di slot spesifik pada kendaraan) ────────

export interface WeaponSlotDef {
  /** Id slot unik dalam satu archetype (mis. "turret_main", "hardpoint_L"). */
  slotId: string;
  /** WeaponDef id (projectiles.ts WEAPON_DEFS). */
  weaponDef: string;
  /** Montase senjata. fixed = menikuti body, turret = berputar independen. */
  mount: "fixed" | "turret" | "coaxial";
  /** Lingkup tembak turret (derajat), null jika fixed/coaxial. */
  arcDeg?: number;
}

// ── Skill (ability yang hanya aktif saat menempati kendaraan ini) ──────────

export interface VehicleSkillDef {
  skillId: string;        // "overload_shield" | "smoke_screen" | "warp_jump" | ...
  cooldownTicks: number;  // cooldown antara pakai skill
  /** true = butuh target (lock), false = area/self. */
  needsTarget: boolean;
}

// ── Kamera default saat memasuki kendaraan ini (presentasi UE5) ────────────

export interface VehicleCameraPreset {
  preset: "cockpit" | "chase" | "orbit" | "tactical";
  fov: number;
  distanceM: number;   // jarak kamera dari titik pusat (chase/orbit)
  pitchDeg: number;    // sudut elevasi kamera default
  yawOffsetDeg: number;
}

// ── Archetype lengkap ──────────────────────────────────────────────────────

export interface VehicleArchetype {
  /** Id unik, dicocokkan dengan asset.arclux.json source/name di gudang aset. */
  id: string;
  /** Tampilan manusia. */
  label: string;
  /** Kategori → biome/tipe aset di ARCLUX-assets (kind: spacecraft/ground/air). */
  kind: VehicleKind;
  /** Gerakan → menentukan UE5 Movement Component yang dipasang ke mesh aset. */
  movementType: VehicleMovementType;
  /** Stat fisika server. */
  maxSpeedMps: number;
  turnRateDegS: number;
  hull: number;     // integritas dasar
  shield: number;   // pelapis tambahan (0 = tidak ada)
  capacitorMax: number;
  /** Senjata per slot. Tank turret_main beda dengan heli rocket pod. */
  weaponSlots: WeaponSlotDef[];
  /** Skill yang bisa dipakai saat duduk di kursi pengemudi. */
  skills: VehicleSkillDef[];
  /** Kamera default + HUD layout. */
  cameraPreset: VehicleCameraPreset;
  hudLayout: "cockpit" | "thirdperson" | "tactical";
  /** Referensi ke aset di ARCLUX-assets/keep (folder atau file glb). */
  assetRef: string;
}

// ── Registry archetype (single source of truth) ────────────────────────────

/** Daftar kendaraan yang didukung. Tambahkan baru di sini (tidak perlu ubah
 *  logika sim — archetype is data, engine is generic). */
export const VEHICLE_ARCHETYPES: Record<string, VehicleArchetype> = {

  // ──────────────────────────────────────────────────────────────────────
  // KAPSUL LUAR ANGKASA — aset: lowpoly_spaceship, procedural_spaceship,
  //               spaceship_4, a_space_ship_server_room_pbr
  // ──────────────────────────────────────────────────────────────────────
  spaceship_interceptor: {
    id: "spaceship_interceptor",
    label: "Interceptor-Class Spaceship",
    kind: "spacecraft",
    movementType: "thruster6dof",
    maxSpeedMps: 1200,
    turnRateDegS: 180,
    hull: 100,
    shield: 40,
    capacitorMax: 200,
    weaponSlots: [
      { slotId: "hardpoint_L", weaponDef: "weapon.railgun", mount: "fixed" },
      { slotId: "hardpoint_R", weaponDef: "weapon.railgun", mount: "fixed" },
      { slotId: "hardpoint_T", weaponDef: "weapon.missile",  mount: "turret", arcDeg: 60 },
    ],
    skills: [
      { skillId: "overload_shield", cooldownTicks: 300, needsTarget: false },
      { skillId: "warp_jump",       cooldownTicks: 600, needsTarget: false },
    ],
    cameraPreset: { preset: "cockpit", fov: 90, distanceM: 0, pitchDeg: 0, yawOffsetDeg: 0 },
    hudLayout: "cockpit",
    assetRef: "lowpoly_spaceship",
  },

  // ──────────────────────────────────────────────────────────────────────
  // TANK — aset: (mobil/tank dari gudang, jika ada) + turret terpisah
  // ──────────────────────────────────────────────────────────────────────
  tank_mbt: {
    id: "tank_mbt",
    label: "Main Battle Tank",
    kind: "ground",
    movementType: "tracked",
    maxSpeedMps: 60,
    turnRateDegS: 40,
    hull: 200,
    shield: 0,
    capacitorMax: 100,
    weaponSlots: [
      { slotId: "turret_main", weaponDef: "weapon.explosive", mount: "turret", arcDeg: 360 },
      { slotId: "coaxial",     weaponDef: "weapon.emp",       mount: "coaxial" },
    ],
    skills: [
      { skillId: "smoke_screen", cooldownTicks: 200, needsTarget: false },
      { skillId: "repair_track", cooldownTicks: 300, needsTarget: false },
    ],
    cameraPreset: { preset: "chase", fov: 75, distanceM: 800, pitchDeg: -15, yawOffsetDeg: 0 },
    hudLayout: "thirdperson",
    assetRef: "futuristic_racing_car_-_molnia", // placeholder, ganti ke model tank asli
  },

  // ──────────────────────────────────────────────────────────────────────
  // HELIKOPTER — aset: helicopter_nypd_crash_project_our_heritage
  // ──────────────────────────────────────────────────────────────────────
  helicopter_transport: {
    id: "helicopter_transport",
    label: "Transport Helicopter",
    kind: "air",
    movementType: "rotorcraft",
    maxSpeedMps: 250,
    turnRateDegS: 90,
    hull: 120,
    shield: 20,
    capacitorMax: 150,
    weaponSlots: [
      { slotId: "nose_gun",  weaponDef: "weapon.emp", mount: "fixed" },
      { slotId: "rocket_L",  weaponDef: "weapon.rocket", mount: "fixed" },
      { slotId: "rocket_R",  weaponDef: "weapon.rocket", mount: "fixed" },
    ],
    skills: [
      { skillId: "flare",      cooldownTicks: 150, needsTarget: false },
      { skillId: "auto_hover", cooldownTicks: 0,    needsTarget: false },
    ],
    cameraPreset: { preset: "chase", fov: 80, distanceM: 600, pitchDeg: -20, yawOffsetDeg: 0 },
    hudLayout: "thirdperson",
    assetRef: "helicopter_nypd_crash_project_our_heritage",
  },

  // ──────────────────────────────────────────────────────────────────────
  // DRONE TROOP CARRIER — aset: sci_fi_flying_drone_troop_carrier
  // ──────────────────────────────────────────────────────────────────────
  drone_troop_carrier: {
    id: "drone_troop_carrier",
    label: "Drone Troop Carrier",
    kind: "air",
    movementType: "rotorcraft",
    maxSpeedMps: 180,
    turnRateDegS: 60,
    hull: 80,
    shield: 10,
    capacitorMax: 120,
    weaponSlots: [
      { slotId: "turret_L", weaponDef: "weapon.emp", mount: "turret", arcDeg: 120 },
      { slotId: "turret_R", weaponDef: "weapon.emp", mount: "turret", arcDeg: 120 },
    ],
    skills: [
      { skillId: "deploy_troops", cooldownTicks: 600, needsTarget: true },
    ],
    cameraPreset: { preset: "tactical", fov: 85, distanceM: 1000, pitchDeg: -45, yawOffsetDeg: 0 },
    hudLayout: "tactical",
    assetRef: "sci_fi_flying_drone_troop_carrier",
  },

  // ──────────────────────────────────────────────────────────────────────
  // MOBIL RACING — aset: futuristic_racing_car_-_molnia
  // ──────────────────────────────────────────────────────────────────────
  racing_car: {
    id: "racing_car",
    label: "Futuristic Racing Car",
    kind: "ground",
    movementType: "wheeled",
    maxSpeedMps: 100,
    turnRateDegS: 120,
    hull: 60,
    shield: 0,
    capacitorMax: 80,
    weaponSlots: [
      { slotId: "front_mount", weaponDef: "weapon.emp", mount: "fixed" },
    ],
    skills: [
      { skillId: "nitro_boost", cooldownTicks: 100, needsTarget: false },
    ],
    cameraPreset: { preset: "chase", fov: 90, distanceM: 500, pitchDeg: -10, yawOffsetDeg: 0 },
    hudLayout: "thirdperson",
    assetRef: "futuristic_racing_car_-_molnia",
  },
} as const;

/** Lookup archetype by id. */
export function getVehicleArchetype(id: string): VehicleArchetype | undefined {
  return VEHICLE_ARCHETYPES[id];
}

/** Semua weaponDef yang dipakai oleh satu archetype (untuk preload/validasi). */
export function archetypeWeaponDefs(archetype: VehicleArchetype): string[] {
  return archetype.weaponSlots.map((s) => s.weaponDef);
}

/** Validasi apakah weaponId cocok dengan salah satu slot pada archetype. */
export function archetypeHasWeapon(archetype: VehicleArchetype, weaponId: string): boolean {
  return archetype.weaponSlots.some((s) => s.weaponDef === weaponId);
}

// ── State kendaraan saat ditempati (volatile, per vessel) ──────────────────

export interface VehicleState {
  archetypeId: string;
  /** Gear / rotor RPM / thruster charge — state spesifik movement type. */
  movementState: Record<string, number>;
  /** Cooldown per skillId (ticks). */
  skillCooldowns: Record<string, number>;
  /** Terakhir kali skill dipakai (tick). */
  lastSkillTick: Record<string, number>;
}

export function createVehicleState(archetypeId: string): VehicleState {
  const arch = VEHICLE_ARCHETYPES[archetypeId];
  const skillCooldowns: Record<string, number> = {};
  for (const s of arch?.skills ?? []) skillCooldowns[s.skillId] = 0;
  return {
    archetypeId,
    movementState: {},
    skillCooldowns,
    lastSkillTick: {},
  };
}

// ── Integrasi ke VesselEntity ──────────────────────────────────────────────

/** Tambah field ke VesselEntity (dipanggil saat inisialisasi vessel). */
export interface VehicleEntityExt {
  /** Archetype yang ditempati vessel ini (undefined = vessel biasa tanpa kendaraan spesial). */
  vehicleArchetypeId?: string;
  /** State volatil kendaraan (dihapus saat keluar / vessel dihapus). */
  vehicleState?: VehicleState;
}

export function attachVehicleToVessel(
  vessel: VesselEntity,
  archetypeId: string
): VehicleState | undefined {
  const arch = VEHICLE_ARCHETYPES[archetypeId];
  if (!arch) return undefined;
  (vessel as VesselEntity & VehicleEntityExt).vehicleArchetypeId = archetypeId;
  (vessel as VesselEntity & VehicleEntityExt).vehicleState = createVehicleState(archetypeId);
  return (vessel as VesselEntity & VehicleEntityExt).vehicleState;
}

export function detachVehicleFromVessel(vessel: VesselEntity): void {
  const ext = vessel as VesselEntity & VehicleEntityExt;
  delete ext.vehicleArchetypeId;
  delete ext.vehicleState;
}

export function getVehicleArchetypeOfVessel(
  vessel: VesselEntity
): VehicleArchetype | undefined {
  const ext = vessel as VesselEntity & VehicleEntityExt;
  if (!ext.vehicleArchetypeId) return undefined;
  return VEHICLE_ARCHETYPES[ext.vehicleArchetypeId];
}
