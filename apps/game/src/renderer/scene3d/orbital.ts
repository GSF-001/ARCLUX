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

export function keplerPosition(o: OrbitSpec, tick: number): THREE.Vector3 {
  const M = o.phase + tick * o.omega;
  const e = o.eccentricity;
  let E = M;
  for (let i = 0; i < 3; i++) E = M + e * Math.sin(E);
  const x = o.semimajor * (Math.cos(E) - e);
  const z = o.semimajor * Math.sqrt(1 - e * e) * Math.sin(E);
  const ci = Math.cos(o.inclination);
  const y = z * Math.sin(o.inclination);
  return new THREE.Vector3(x, y, z * ci);
}
