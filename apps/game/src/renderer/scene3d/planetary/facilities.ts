// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

import * as THREE from "three";
import { threeColor, colors } from "../../../ui/tokens";

export const FACILITIES = ["Landing Pad", "Hangar", "Repair", "Refit", "Radar", "Comms", "Military", "Storage", "Manufacturing", "Spaceport"] as const;
export type FacilityKind = typeof FACILITIES[number];

export interface FacilityOpts {
  kind: FacilityKind;
  position: { x: number; y: number; z: number };
  communityId?: string;
}

export function canBuildOnEmptyLand(height: number, slope: number, isOcean: boolean, forestDensity = 0): boolean {
  return !isOcean && slope < 0.3 && height > -5 && height < 300 && forestDensity < 0.6;
}

export function isInEmptyLand(pos: { x: number; z: number }, heightmap: (x: number, z: number) => number, slopeMap?: (x: number, z: number) => number): boolean {
  const h = heightmap(pos.x, pos.z);
  const slope = slopeMap ? slopeMap(pos.x, pos.z) : 0.1;
  return canBuildOnEmptyLand(h, slope, h < -2);
}

function createGeometryForKind(kind: FacilityKind): { geom: THREE.BufferGeometry; mat: THREE.Material; height: number } {
  switch (kind) {
    case "Landing Pad":
      return { geom: new THREE.CylinderGeometry(28, 28, 2.5, 32), mat: new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), roughness: 0.85, metalness: 0.2 }), height: 1.5 };
    case "Hangar":
      return { geom: new THREE.BoxGeometry(60, 24, 80), mat: new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), metalness: 0.65, roughness: 0.45 }), height: 12 };
    case "Repair":
      return { geom: new THREE.BoxGeometry(48, 18, 48), mat: new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.6, metalness: 0.35 }), height: 9 };
    case "Refit":
      return { geom: new THREE.CylinderGeometry(22, 26, 20, 24), mat: new THREE.MeshStandardMaterial({ color: 0x5a6a8a, roughness: 0.55, metalness: 0.4 }), height: 10 };
    case "Radar":
      return { geom: new THREE.SphereGeometry(11, 18, 14), mat: new THREE.MeshStandardMaterial({ color: threeColor(colors.tech), emissive: threeColor(colors.tech), emissiveIntensity: 0.55, roughness: 0.35 }), height: 14 };
    case "Comms":
      return { geom: new THREE.CylinderGeometry(2, 2, 34, 12), mat: new THREE.MeshStandardMaterial({ color: 0x7a9aba, emissive: 0x4a7aaa, emissiveIntensity: 0.25 }), height: 17 };
    case "Military":
      return { geom: new THREE.BoxGeometry(44, 22, 44), mat: new THREE.MeshStandardMaterial({ color: 0x3d4a3d, roughness: 0.8, metalness: 0.15 }), height: 11 };
    case "Storage":
      return { geom: new THREE.BoxGeometry(52, 16, 36), mat: new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.75 }), height: 8 };
    case "Manufacturing":
      return { geom: new THREE.BoxGeometry(70, 20, 50), mat: new THREE.MeshStandardMaterial({ color: 0x5a5a6a, roughness: 0.6, metalness: 0.5 }), height: 10 };
    case "Spaceport":
      return { geom: new THREE.TorusGeometry(22, 3.2, 12, 32), mat: new THREE.MeshStandardMaterial({ color: threeColor(colors.tactical), emissive: threeColor(colors.tactical), emissiveIntensity: 0.38, roughness: 0.4 }), height: 8 };
    default:
      return { geom: new THREE.BoxGeometry(40, 20, 40), mat: new THREE.MeshStandardMaterial({ color: 0x3a4a6a }), height: 10 };
  }
}

export function createFacilityMesh(kind: FacilityKind, opts: FacilityOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = `facility-${kind}`;
  g.userData.kind = kind;
  const { geom, mat, height } = createGeometryForKind(kind);
  const mesh = new THREE.Mesh(geom, mat as any);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(opts.position.x, opts.position.y + height / 2, opts.position.z);
  if (kind === "Comms") mesh.position.y += 8;
  mesh.name = "facilityMesh";
  g.add(mesh);

  if (kind === "Radar") {
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x9abacd, metalness: 0.7, roughness: 0.3 }));
    dish.position.set(opts.position.x, opts.position.y + 18, opts.position.z);
    dish.rotation.x = Math.PI / 6;
    dish.name = "radarDish";
    g.add(dish);
  }
  if (kind === "Comms") {
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5 + i * 2, 0.4, 8, 24), new THREE.MeshBasicMaterial({ color: 0x5fa8ff, transparent: true, opacity: 0.35 - i * 0.08 }));
      ring.position.set(opts.position.x, opts.position.y + 22 + i * 6, opts.position.z);
      ring.rotation.x = Math.PI / 2;
      ring.name = "commsRing";
      g.add(ring);
    }
  }

  const healthBar = new THREE.Mesh(new THREE.BoxGeometry(36, 2, 2), new THREE.MeshBasicMaterial({ color: 0x5fe0a0 }));
  healthBar.position.set(opts.position.x, opts.position.y + height + 10, opts.position.z);
  healthBar.name = "healthBar";
  g.add(healthBar);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(kind === "Landing Pad" ? 30 : 22, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(opts.position.x, opts.position.y + 0.2, opts.position.z);
  shadow.name = "shadow";
  g.add(shadow);

  return g;
}

export function updateFacilityHealth(group: THREE.Group, health: number): void {
  const bar = group.getObjectByName("healthBar") as THREE.Mesh | null;
  if (bar) {
    const mat = bar.material as THREE.MeshBasicMaterial;
    const c = health > 60 ? 0x5fe0a0 : health > 30 ? 0xf5a742 : 0xff5a5f;
    mat.color.setHex(c);
    bar.scale.x = Math.max(0, health / 100);
    bar.visible = health < 100 && health > 0;
  }
  const mesh = group.getObjectByName("facilityMesh") as THREE.Mesh | null;
  if (mesh) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.emissive) mat.emissiveIntensity = health < 30 ? 0.12 : health < 60 ? 0.3 : (mat as any).emissiveIntensity ?? 0.4;
  }
}

export function clampCharacterSpeed(vel: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const speed = Math.hypot(vel.x, vel.z);
  if (speed > 5.5) { const s = 5.5 / speed; return { x: vel.x * s, y: vel.y, z: vel.z * s }; }
  return vel;
}

export function facilityFootprint(kind: FacilityKind): { radius: number; height: number } {
  const map: Record<FacilityKind, { radius: number; height: number }> = {
    "Landing Pad": { radius: 30, height: 4 },
    "Hangar": { radius: 42, height: 24 },
    "Repair": { radius: 30, height: 18 },
    "Refit": { radius: 28, height: 20 },
    "Radar": { radius: 18, height: 22 },
    "Comms": { radius: 12, height: 34 },
    "Military": { radius: 30, height: 22 },
    "Storage": { radius: 32, height: 16 },
    "Manufacturing": { radius: 40, height: 20 },
    "Spaceport": { radius: 32, height: 18 },
  };
  return map[kind] ?? { radius: 24, height: 16 };
}
