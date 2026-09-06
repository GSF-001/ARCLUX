// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/night.ts - 10.6 night: emissive #ffd9a0 96 windows/ring + PointLight runway amber + Radar 50000. Zoom dari blueprint "Night & Discovery - Planet Feels Inhabited Without NPCs".

// Blueprint 10 §11: Night facility emissive stays saat DirectionalLight off,
// orbit sees light -> descend -> runway -> hangar. Radar 50000 via world.ts.
// File ini ZOOM dari 2 baris blueprint jadi visual + logic radar per-chunk.

import * as THREE from "three";

// ---------------------------------------------------------------------------
// Night constants - dari blueprint §11, bukan ngarang
// ---------------------------------------------------------------------------

export const NIGHT_EMISSIVE = "#ffd9a0"; // warm amber dari blueprint
export const RUNWAY_LIGHT_COLOR = 0xffb84d; // amber runway
export const NIGHT_WINDOW_COUNT = 96; // per ring
export const RADAR_RANGE = 50000; // m - world.ts:83 entitiesWithin

// ---------------------------------------------------------------------------
// Facility night lights - emissive + PointLight runway
// ---------------------------------------------------------------------------

export interface NightLightOpts {
  kind: string;
  position: { x: number; y: number; z: number };
  health?: number; // 0..100, 0 = mati
}

/**
 * Tambah night lights ke group facility yang sudah ada.
 * - 96 windows kecil emissive #ffd9a0 di ring (hanya untuk Hangar/Spaceport/Military)
 * - 1 PointLight runway amber (hanya Landing Pad / Spaceport)
 * Visual-only, gak masuk WorldRegion.
 */
export function attachNightLights(group: THREE.Group, opts: NightLightOpts): void {
  const health = opts.health ?? 100;
  if (health < 5) return; // wrecked, mati

  const emissiveIntensity = 0.8 * (health / 100);

  // Windows - 96 titik kecil di sekeliling group
  if (opts.kind === "Hangar" || opts.kind === "Spaceport" || opts.kind === "Military") {
    const winGeo = new THREE.SphereGeometry(0.6, 6, 6);
    const winMat = new THREE.MeshStandardMaterial({
      color: NIGHT_EMISSIVE,
      emissive: NIGHT_EMISSIVE,
      emissiveIntensity,
    });
    const ringRadius = opts.kind === "Hangar" ? 32 : 26;
    for (let i = 0; i < NIGHT_WINDOW_COUNT; i++) {
      const ang = (i / NIGHT_WINDOW_COUNT) * Math.PI * 2;
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(Math.cos(ang) * ringRadius, 8 + (i % 3) * 3, Math.sin(ang) * ringRadius);
      win.name = "nightWindow";
      group.add(win);
    }
  }

  // Runway PointLight - amber, intensity 2, distance 120
  if (opts.kind === "Landing Pad" || opts.kind === "Spaceport") {
    const light = new THREE.PointLight(RUNWAY_LIGHT_COLOR, 2, 120, 1.5);
    light.position.set(0, 6, 0);
    light.name = "runwayLight";
    // is PointLight, not Mesh - tetap child group
    group.add(light as unknown as THREE.Object3D);

    // Runway edge lights - 12 titik di keliling pad
    const edgeGeo = new THREE.SphereGeometry(0.9, 8, 8);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: RUNWAY_LIGHT_COLOR,
      emissive: RUNWAY_LIGHT_COLOR,
      emissiveIntensity: 1.2 * (health / 100),
    });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(Math.cos(ang) * 28, 1.2, Math.sin(ang) * 28);
      edge.name = "runwayEdge";
      group.add(edge);
    }
  }
}

/**
 * Update night visibility saat day/night.
 * - isNight=true -> DirectionalLight off, facility emissive stays (PMREM off)
 * - isNight=false -> emissive dim 0.2, runway off
 * Dipanggil dari renderer tiap tick dengan EnvironmentalContext.timeOfDay.
 */
export function updateNightVisibility(
  group: THREE.Group,
  isNight: boolean,
  sunIntensity: number, // 0..1
): void {
  const targetEmissive = isNight ? 0.8 : 0.15 + sunIntensity * 0.1;
  group.traverse((obj) => {
    if (obj.name === "nightWindow" || obj.name === "runwayEdge") {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.emissive) mat.emissiveIntensity = isNight ? targetEmissive : 0.15;
      (mesh as any).visible = isNight || (mat as any).emissiveIntensity > 0.2;
    }
    if (obj.name === "runwayLight") {
      const light = obj as unknown as THREE.PointLight;
      (light as any).intensity = isNight ? 2 : 0.2;
      (light as any).visible = isNight;
    }
  });
}

// ---------------------------------------------------------------------------
// Radar discovery - pakai world.ts:83 entitiesWithin + directory per blueprint
// ---------------------------------------------------------------------------

export interface RadarContact {
  id: string;
  kind: string;
  distance: number; // m
  position: { x: number; y: number; z: number };
  unknown: boolean; // >30km atau health rendah -> Unknown
}

export interface RadarDiscovery {
  contacts: RadarContact[];
  nearest: RadarContact | null;
  unknownCount: number;
}

/**
 * Radar scan 50km - pure function, gak sentuh THREE.
 * Input: entities = hasil world.ts entitiesWithin(pos, 50000) + directory listServers.
 * Output: sorted by distance, Unknown kalau >30000 atau health<20.
 * Dipanggil di client tiap 2s, bukan tiap tick.
 */
export function discoverViaRadar(
  origin: { x: number; y: number; z: number },
  entities: Array<{ id: string; kind: string; position: { x: number; y: number; z: number }; health?: number }>,
): RadarDiscovery {
  const contacts: RadarContact[] = entities.map((e) => {
    const dx = e.position.x - origin.x;
    const dz = e.position.z - origin.z;
    const dist = Math.hypot(dx, Math.hypot(e.position.y - origin.y, dz));
    const unknown = dist > 30000 || (e.health ?? 100) < 20;
    return { id: e.id, kind: unknown ? "Unknown" : e.kind, distance: dist, position: e.position, unknown };
  });
  contacts.sort((a, b) => a.distance - b.distance);
  // Batasi 12 terdekat biar UI gak spam
  const sliced = contacts.slice(0, 12);
  return {
    contacts: sliced,
    nearest: sliced[0] ?? null,
    unknownCount: sliced.filter((c) => c.unknown).length,
  };
}

/** Format radar untuk HUD: "Hangar-A 12 km / Unknown 430 km". */
export function formatRadarHud(d: RadarDiscovery): string {
  if (d.contacts.length === 0) return "No contacts within 50km";
  return d.contacts
    .map((c) => `${c.kind} ${c.id.slice(0, 6)} ${(c.distance / 1000).toFixed(c.distance > 10000 ? 0 : 1)} km${c.unknown ? " ?" : ""}`)
    .join(" / ");
}
