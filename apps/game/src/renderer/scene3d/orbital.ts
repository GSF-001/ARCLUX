// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/orbital.ts — orbit math Kepler deterministik per tick (§2.3).
// Moved verbatim dari scene3d.ts — pure math, zero behavior change.

import * as THREE from "three";

export interface OrbitSpec {
  /** semi-major axis (render units). */
  semimajor: number;
  /** eccentricity 0..<1. */
  eccentricity: number;
  /** rotation per tick (rad). */
  omega: number;
  /** phase offset (rad). */
  phase: number;
  inclination: number;
}

/** Posisi orbit Kepler dari Mean anomaly — iterasi 3× (cukup buat e<0.4, deterministik). */
export function keplerPosition(o: OrbitSpec, tick: number): THREE.Vector3 {
  const M = o.phase + tick * o.omega;
  const e = o.eccentricity;
  // Iterasi 3× buat Mean→Eccentric anomaly (cukup buat e<0.4; deterministik).
  let E = M;
  for (let i = 0; i < 3; i++) E = M + e * Math.sin(E);
  const x = o.semimajor * (Math.cos(E) - e);
  const z = o.semimajor * Math.sqrt(1 - e * e) * Math.sin(E);
  // Rossi ke bidang miring (inclination).
  const ci = Math.cos(o.inclination);
  const y = z * Math.sin(o.inclination);
  return new THREE.Vector3(x, y, z * ci);
}
