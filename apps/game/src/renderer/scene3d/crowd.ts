// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/crowd.ts — H1.2 Crowd simple: capsule agen deterministic, 0 AI.
// Agen = fungsi timeSec (posisi = loop waypoint). InstancedMesh per warna
// (3 draw call total). LOW fallback = 0 agen.

import * as THREE from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CrowdRole = "crew" | "merchant" | "guard";

interface CrowdWaypoint {
  x: number;
  z: number;
}

interface CrowdLane {
  role: CrowdRole;
  color: number;
  waypoints: CrowdWaypoint[];
  count: number;
}

export interface CrowdSystem {
  lanes: Array<{
    instanced: THREE.InstancedMesh;
    lane: CrowdLane;
  }>;
  group: THREE.Group;
  totalAgents: number;
}

// ---------------------------------------------------------------------------
// Colors (matching interior palette)
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<CrowdRole, number> = {
  crew: 0x3a7abd,     // blue-grey
  merchant: 0xc4954a, // warm amber
  guard: 0x6b7280,    // steel
};

// ---------------------------------------------------------------------------
// Waypoint generators — loop paths on promenade/plaza
// ---------------------------------------------------------------------------

function promenadeLane(ring: number, role: CrowdRole, count: number): CrowdLane {
  const cx = -400 + ring * 500;
  const radius = 640 + ring * 46;
  const pts: CrowdWaypoint[] = [];
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(ang) * radius, z: Math.sin(ang) * radius });
  }
  return { role, color: ROLE_COLORS[role], waypoints: pts, count };
}

function plazaLane(role: CrowdRole, count: number): CrowdLane {
  const pts: CrowdWaypoint[] = [];
  const segments = 6;
  const radius = 280;
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(ang) * radius, z: Math.sin(ang) * radius });
  }
  return { role, color: ROLE_COLORS[role], waypoints: pts, count };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const AGENT_HEIGHT = 6;
const AGENT_RADIUS = 2;
const AGENT_SEGMENTS = 6;

export function createCrowdSystem(tier: "HIGH" | "MEDIUM" | "LOW"): CrowdSystem {
  const group = new THREE.Group();
  group.name = "crowd-system";

  if (tier === "LOW") return { lanes: [], group, totalAgents: 0 };

  const counts = tier === "HIGH"
    ? { crew: 10, merchant: 8, guard: 6 }
    : { crew: 4, merchant: 3, guard: 0 };

  const total = counts.crew + counts.merchant + counts.guard;
  if (total === 0) return { lanes: [], group, totalAgents: 0 };

  const agentGeo = new THREE.CapsuleGeometry(AGENT_RADIUS, AGENT_HEIGHT, 4, AGENT_SEGMENTS);

  const lanes: CrowdSystem["lanes"] = [];

  // Promenade lanes — 4 rings, crew on ring 0+2, merchant on ring 1+3
  const promLanes: Array<{ ring: number; role: CrowdRole; count: number }> = [
    { ring: 0, role: "crew", count: counts.crew > 0 ? Math.ceil(counts.crew / 2) : 0 },
    { ring: 1, role: "merchant", count: counts.merchant > 0 ? Math.ceil(counts.merchant / 2) : 0 },
    { ring: 2, role: "crew", count: counts.crew > 0 ? Math.floor(counts.crew / 2) : 0 },
    { ring: 3, role: "merchant", count: counts.merchant > 0 ? Math.floor(counts.merchant / 2) : 0 },
  ];

  // Plaza lane — guards patrol center
  if (counts.guard > 0) {
    promLanes.push({ ring: -1, role: "guard", count: counts.guard });
  }

  for (const pl of promLanes) {
    if (pl.count <= 0) continue;
    const lane = pl.ring === -1
      ? plazaLane(pl.role, pl.count)
      : promenadeLane(pl.ring, pl.role, pl.count);

    const mat = new THREE.MeshStandardMaterial({
      color: lane.color,
      roughness: 0.7,
      metalness: 0.2,
    });
    const instanced = new THREE.InstancedMesh(agentGeo, mat, lane.count);
    instanced.name = `crowd-${pl.role}`;
    instanced.frustumCulled = false;
    group.add(instanced);
    lanes.push({ instanced, lane });
  }

  return { lanes, group, totalAgents: total };
}

// ---------------------------------------------------------------------------
// Tick — deterministic f(timeSec), 0 state
// ---------------------------------------------------------------------------

const SPEED = 40; // units per second

export function tickCrowd(sys: CrowdSystem, timeSec: number): void {
  const dummy = new THREE.Object3D();

  for (const { instanced, lane } of sys.lanes) {
    const wp = lane.waypoints;
    if (wp.length < 2) continue;

    // Total loop length
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < wp.length; i++) {
      const next = wp[(i + 1) % wp.length];
      const dx = next.x - wp[i].x;
      const dz = next.z - wp[i].z;
      const len = Math.hypot(dx, dz);
      segLens.push(len);
      totalLen += len;
    }

    for (let a = 0; a < lane.count; a++) {
      // Each agent offset by fraction of total loop
      const agentOffset = (a / lane.count) * totalLen;
      const dist = ((timeSec * SPEED + agentOffset) % totalLen + totalLen) % totalLen;

      // Find which segment this agent is on
      let accum = 0;
      for (let i = 0; i < wp.length; i++) {
        if (accum + segLens[i] >= dist) {
          const t = segLens[i] > 0 ? (dist - accum) / segLens[i] : 0;
          const cur = wp[i];
          const next = wp[(i + 1) % wp.length];
          dummy.position.set(
            cur.x + (next.x - cur.x) * t,
            0,
            cur.z + (next.z - cur.z) * t,
          );
          // Face direction of travel
          dummy.rotation.y = Math.atan2(next.x - cur.x, next.z - cur.z);
          break;
        }
        accum += segLens[i];
      }

      dummy.updateMatrix();
      instanced.setMatrixAt(a, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Dispose
// ---------------------------------------------------------------------------

export function disposeCrowd(sys: CrowdSystem): void {
  for (const { instanced } of sys.lanes) {
    instanced.geometry.dispose();
    (instanced.material as THREE.Material).dispose();
  }
  sys.lanes.length = 0;
}
