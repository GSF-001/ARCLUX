// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/hydrological.ts - 10.G G4 Hydrological Continuity: MOUNTAIN->STREAM->RIVER->LAKE->COAST->OCEAN.

// Wired via planetary/wire10G — ticked per frame from EnvironmentalContext.

import * as THREE from "three";

export interface RiverFlow {
  direction: { x: number; z: number };
  speed: number;
  foam: number;
  wetBanks: number;
  waterfall: number;
  toOcean: number;
}

export function getRiverFlow(height: number, slope: number, neighborHeights: number[]): RiverFlow {
  const dirs = [
    { x: 0, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 0 }, { x: 1, z: 1 },
    { x: 0, z: 1 }, { x: -1, z: 1 }, { x: -1, z: 0 }, { x: -1, z: -1 },
  ];
  let maxDiff = 0;
  let dirX = 0, dirZ = 0;
  for (let i = 0; i < 8; i++) {
    const diff = height - (neighborHeights[i] ?? height);
    if (diff > maxDiff) {
      maxDiff = diff;
      dirX = dirs[i].x;
      dirZ = dirs[i].z;
    }
  }
  const len = Math.hypot(dirX, dirZ) || 1;
  const steep = slope * 1.8;
  const drop = Math.min(1, maxDiff * 0.022);
  const speed = Math.min(1, steep + drop + 0.06);
  const waterfall = maxDiff > 18 && slope > 0.32 ? Math.min(1, (maxDiff - 18) * 0.04 + slope * 0.5) : 0;
  const foam = waterfall > 0.2 ? 0.62 + waterfall * 0.38 : slope > 0.24 ? Math.min(1, speed * 0.82 + 0.16) : speed * 0.32;
  const wetBanks = height < 18 ? 0.62 + foam * 0.28 : height < 80 ? 0.38 + foam * 0.32 : foam * 0.28;
  const toOcean = height > -4 && height < 8 && distApprox(height) < 1 ? 0.72 + foam * 0.28 : height < -1 ? 0.45 : 0;
  return { direction: { x: dirX / len, z: dirZ / len }, speed, foam, wetBanks, waterfall, toOcean };
}

function distApprox(h: number): number { return Math.abs(h) * 0.08; }

export interface RiverSystem {
  flowMeshes: THREE.Mesh[];
  waterfallPoints: THREE.Points;
}

export function createRiverSystem(): RiverSystem {
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(14 + i * 2, 68 - i * 8);
    const m = new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.32, metalness: 0.14, transparent: true, opacity: 0.52 });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04 + i * 0.012;
    mesh.name = `river-${i}`;
    meshes.push(mesh);
  }
  const geo = new THREE.BufferGeometry();
  const cnt = 180;
  const pos = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 1] = Math.random() * 9;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 22;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.38, transparent: true, opacity: 0, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.name = "riverWaterfall";
  points.visible = false;
  return { flowMeshes: meshes, waterfallPoints: points };
}

export function tickRiver(sys: RiverSystem, flow: RiverFlow, isRaining: boolean, dt: number): void {
  const rainBoost = isRaining ? 1.32 : 1;
  const foamTarget = 0.45 + flow.foam * 0.42;
  sys.flowMeshes.forEach((m, idx) => {
    const mat = m.material as THREE.MeshStandardMaterial;
    const wb = flow.wetBanks * (0.9 + idx * 0.07);
    mat.opacity = 0.42 + wb * 0.28;
    mat.roughness = 0.42 - flow.speed * 0.12;
    const oceanMix = flow.toOcean;
    if (oceanMix > 0.12) {
      mat.color.setHSL(0.55 + oceanMix * 0.03, 0.62 - oceanMix * 0.18, 0.52 + oceanMix * 0.08);
      mat.opacity = 0.38 + oceanMix * 0.18;
    } else {
      mat.color.setHSL(0.56, 0.52, 0.48 + flow.wetBanks * 0.08);
    }
    m.position.x += flow.direction.x * flow.speed * rainBoost * dt * (5.2 + idx * 0.8);
    m.position.z += flow.direction.z * flow.speed * rainBoost * dt * (5.2 + idx * 0.8);
    m.position.x = ((m.position.x + 60) % 120) - 60;
    m.position.z = ((m.position.z + 60) % 120) - 60;
    const foamColor = new THREE.Color(0xffffff).multiplyScalar(flow.foam * 0.14);
    (mat as any).emissive = foamColor;
    (mat as any).emissiveIntensity = foamTarget * 0.22;
  });
  const wpMat = sys.waterfallPoints.material as THREE.PointsMaterial;
  const wfTarget = flow.waterfall > 0.18 ? 0.42 + flow.waterfall * 0.38 : 0;
  wpMat.opacity += (wfTarget - wpMat.opacity) * Math.min(1, dt * 2.2);
  sys.waterfallPoints.visible = wpMat.opacity > 0.06;
  if (sys.waterfallPoints.visible) {
    const pos = sys.waterfallPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - (2.2 + flow.waterfall * 3.5) * dt;
      if (y < 0) y = 8.5 + Math.random() * 1.5;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.04);
    }
    pos.needsUpdate = true;
  }
}

export function disposeRiver(sys: RiverSystem): void {
  sys.flowMeshes.forEach(m => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
  sys.waterfallPoints.geometry.dispose();
  (sys.waterfallPoints.material as THREE.Material).dispose();
}
