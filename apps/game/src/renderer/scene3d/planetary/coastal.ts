// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/coastal.ts - 10.G G3 Coastal Transition: LAND->WET SHORE->SHALLOW->OPEN OCEAN + foam/spray/shoreline mist. Zoom dari blueprint G3.

// WIRE NOTE for SESSION 2: import { getCoastalZone, createCoastalSystem, tickCoastal } from "./planetary/coastal" di scene3d/index.ts. Get zone per position, tick spray via storm.

import * as THREE from "three";

export type CoastalZone = "land" | "wet_shore" | "shallow" | "open_ocean";

export function getCoastalZone(height: number, distToCoast: number, slope: number): CoastalZone {
  if (height < -12) return "open_ocean"; // depth >12
  if (distToCoast < 40 && height > -2 && height < 3) return "wet_shore";
  if (distToCoast < 280) return "shallow";
  return "land";
}

export interface CoastalSystem {
  foamMeshes: THREE.Mesh[]; // 3 foam quads
  mistPoints: THREE.Points;
}

export function createCoastalSystem(): CoastalSystem {
  const foams: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(36, 36);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06;
    mesh.visible = false;
    mesh.name = `coastalFoam-${i}`;
    foams.push(mesh);
  }
  const geo = new THREE.BufferGeometry();
  const cnt = 300;
  const pos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) pos[i * 3 + 1] = Math.random() * 6;
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.5, transparent: true, opacity: 0, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.name = "coastalMist";
  return { foamMeshes: foams, mistPoints: points };
}

export function tickCoastal(
  sys: CoastalSystem,
  zone: CoastalZone,
  isStorm: boolean,
  windSpeed: number,
  dt: number,
): void {
  const inCoastal = zone === "wet_shore" || zone === "shallow";
  const intensity = isStorm ? 0.7 + windSpeed * 0.04 : zone === "wet_shore" ? 0.35 : 0.15;
  sys.foamMeshes.forEach((m, idx) => {
    const mat = m.material as THREE.MeshBasicMaterial;
    const target = inCoastal ? intensity * (0.6 + idx * 0.2) : 0;
    mat.opacity = Math.min(0.55, target);
    m.visible = mat.opacity > 0.05;
    // Foam drift via wind
    m.position.x += Math.cos(windSpeed) * dt * 2;
  });
  const mat = sys.mistPoints.material as THREE.PointsMaterial;
  mat.opacity = inCoastal && isStorm ? Math.min(0.4, intensity * 0.5) : 0;
  sys.mistPoints.visible = mat.opacity > 0.05;
  if (sys.mistPoints.visible) {
    const pos = sys.mistPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + windSpeed * 0.02 * dt * 10;
      if (y > 8) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}
