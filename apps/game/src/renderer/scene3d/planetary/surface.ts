// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export function timeOfDayFromMs(ms: number): TimeOfDay {
  const h = (ms % 86400000) / 3600000;
  if (h < 5 || h > 19) return "night";
  if (h < 7) return "dawn";
  if (h > 17) return "dusk";
  return "day";
}

export function sunDirectionFromTime(ms: number, planetSeed: number): THREE.Vector3 {
  const t = (ms % 86400000) / 86400000;
  const ang = t * Math.PI * 2 + (planetSeed % 1000) * 0.001;
  const elev = Math.sin((t - 0.25) * Math.PI * 2) * 1.1;
  return new THREE.Vector3(Math.cos(ang), Math.max(-0.3, elev), 0.2).normalize();
}

export function moonDirectionFromTime(ms: number, planetSeed: number): THREE.Vector3 {
  const t = (ms % 86400000) / 86400000;
  const ang = t * Math.PI * 2 + Math.PI + (planetSeed % 777) * 0.002;
  return new THREE.Vector3(Math.cos(ang), Math.sin(ang) * 0.5, 0.3).normalize();
}

export function lerpSpaceToSurface(t: number, clouds: THREE.Group, terrain: THREE.Group, atmosphere: THREE.Group): void {
  const clamped = Math.max(0, Math.min(1, t));
  const cloudOpacity = clamped < 0.25 ? 0 : clamped < 0.65 ? (clamped - 0.25) / 0.4 : 1 - (clamped - 0.65) / 0.35 * 0.25;
  clouds.visible = clamped > 0.18 && clamped < 0.88;
  clouds.traverse((o: any) => {
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m: any) => { if (m.opacity !== undefined) m.opacity = cloudOpacity; });
      else if (o.material.opacity !== undefined) o.material.opacity = cloudOpacity;
    }
  });
  terrain.visible = clamped > 0.32;
  atmosphere.visible = clamped > 0.12;
  const haze = atmosphere.getObjectByName("haze") as THREE.Mesh | null;
  if (haze) (haze.material as THREE.MeshBasicMaterial).opacity = 0.06 * (1 - clamped * 0.65);
  const mie = atmosphere.getObjectByName("mie") as THREE.Mesh | null;
  if (mie) (mie.material as THREE.MeshBasicMaterial).opacity = 0.015 * (1 - clamped * 0.6);
}

export function altitudeToLerp(altitude: number): number {
  if (altitude > 80000) return 0;
  if (altitude > 30000) return 0.15 + (80000 - altitude) / 50000 * 0.15;
  if (altitude > 8000) return 0.3 + (30000 - altitude) / 22000 * 0.3;
  if (altitude > 800) return 0.6 + (8000 - altitude) / 7200 * 0.2;
  return 0.8 + Math.max(0, (800 - altitude) / 800) * 0.2;
}

export function canAutoLand(distToPad: number, speed: number): boolean {
  return distToPad < 800 && speed < 25;
}

export function isOnLandingTrajectory(distToPad: number, altitude: number, verticalSpeed: number): boolean {
  return distToPad < 2000 && altitude < 400 && Math.abs(verticalSpeed) < 35;
}

export function raycastCrash(altitude: number, verticalSpeed: number): boolean {
  return altitude < 12 && Math.abs(verticalSpeed) > 18;
}

export function approachGateLink(vesselPos: { x: number; y: number; z: number }, padPos: { x: number; y: number; z: number }, gateRadius = 800): { inside: boolean; distance: number; t: number } {
  const dx = vesselPos.x - padPos.x, dz = vesselPos.z - padPos.z;
  const d = Math.hypot(dx, Math.hypot(vesselPos.y - padPos.y, dz));
  return { inside: d < gateRadius, distance: d, t: Math.max(0, 1 - d / gateRadius) };
}
