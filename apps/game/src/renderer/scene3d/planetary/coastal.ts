// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/coastal.ts - 10.G G3 Coastal Transition: LAND->WET SHORE->SHALLOW->OPEN OCEAN + foam/spray/shoreline mist.

// Wired via planetary/wireG — ticked per frame from EnvironmentalContext.

import * as THREE from "three";

export type CoastalZone = "land" | "wet_shore" | "shallow" | "open_ocean";

export function getCoastalZone(height: number, distToCoast: number, slope: number): CoastalZone {
  if (height < -12) return "open_ocean";
  if (distToCoast < 42 && height > -2.4 && height < 3.2) return "wet_shore";
  if (distToCoast < 280) return "shallow";
  return "land";
}

export function coastalLerpFactor(distToCoast: number): number {
  if (distToCoast < 42) return 1 - distToCoast / 42;
  if (distToCoast < 280) return 0.55 * (1 - (distToCoast - 42) / 238);
  return 0;
}

export interface CoastalSystem {
  foamMeshes: THREE.Mesh[];
  mistPoints: THREE.Points;
  shallowPlane: THREE.Mesh;
  /** R1.6 — River glint line (sun reflection on water surface near coast) */
  riverGlint: THREE.Mesh;
  /** R1.6 — Post-storm mist that persists after storm ends */
  postStormMist: THREE.Points;
}

export function createCoastalSystem(): CoastalSystem {
  const foams: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.PlaneGeometry(36 + i * 6, 36 + i * 6);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06 + i * 0.008;
    mesh.visible = false;
    mesh.name = `coastalFoam-${i}`;
    foams.push(mesh);
  }
  const geo = new THREE.BufferGeometry();
  const cnt = 420;
  const pos = new Float32Array(cnt * 3);
  const vel = new Float32Array(cnt);
  for (let i = 0; i < cnt; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = Math.random() * 7;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    vel[i] = 0.4 + Math.random() * 0.9;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("vel", new THREE.BufferAttribute(vel, 1));
  const mat = new THREE.PointsMaterial({ color: 0xc7e4ff, size: 0.52, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.name = "coastalMist";
  points.frustumCulled = false;
  const sg = new THREE.PlaneGeometry(520, 520);
  const sm = new THREE.MeshStandardMaterial({ color: 0x4a8ab8, transparent: true, opacity: 0, roughness: 0.42, metalness: 0.04, depthWrite: false });
  const shallowPlane = new THREE.Mesh(sg, sm);
  shallowPlane.rotation.x = -Math.PI / 2;
  shallowPlane.position.y = -0.9;
  shallowPlane.name = "coastalShallow";
  shallowPlane.visible = false;

  // R1.6 — River glint: thin reflective plane near coast (sun glint path)
  const glintGeo = new THREE.PlaneGeometry(4, 80);
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const riverGlint = new THREE.Mesh(glintGeo, glintMat);
  riverGlint.rotation.x = -Math.PI / 2;
  riverGlint.position.y = 0.04;
  riverGlint.name = "riverGlint";
  riverGlint.visible = false;

  // R1.6 — Post-storm mist: persists 15s after storm ends, fades slowly
  const psCount = 180;
  const psGeo = new THREE.BufferGeometry();
  const psPos = new Float32Array(psCount * 3);
  const psVel = new Float32Array(psCount);
  for (let i = 0; i < psCount; i++) {
    psPos[i * 3] = (Math.random() - 0.5) * 120;
    psPos[i * 3 + 1] = Math.random() * 5;
    psPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    psVel[i] = 0.2 + Math.random() * 0.4;
  }
  psGeo.setAttribute("position", new THREE.BufferAttribute(psPos, 3));
  psGeo.setAttribute("vel", new THREE.BufferAttribute(psVel, 1));
  const psMat = new THREE.PointsMaterial({
    color: 0xc7e4ff, size: 0.6, transparent: true, opacity: 0,
    depthWrite: false, sizeAttenuation: true,
  });
  const postStormMist = new THREE.Points(psGeo, psMat);
  postStormMist.name = "postStormMist";
  postStormMist.frustumCulled = false;

  return { foamMeshes: foams, mistPoints: points, shallowPlane, riverGlint, postStormMist };
}

/**
 * R1.6 enhanced: river glint + post-storm mist persistence.
 * wasStorm tracks if storm recently ended (for 15s mist linger).
 */
export function tickCoastal(
  sys: CoastalSystem,
  zone: CoastalZone,
  distToCoast: number,
  isStorm: boolean,
  windSpeed: number,
  windDir: number,
  dt: number,
  sunAngle?: number,
  wasStorm?: boolean,
): void {
  const lerp = coastalLerpFactor(distToCoast);
  const inCoastal = zone === "wet_shore" || zone === "shallow";
  const base = isStorm ? 0.62 + windSpeed * 0.035 : zone === "wet_shore" ? 0.34 : zone === "shallow" ? 0.18 : 0;
  const stormBoost = isStorm ? 1.35 : 1;
  sys.foamMeshes.forEach((m, idx) => {
    const mat = m.material as THREE.MeshBasicMaterial;
    const phase = (idx / sys.foamMeshes.length) * Math.PI;
    const target = inCoastal ? Math.min(0.58, base * (0.62 + idx * 0.14) * stormBoost * (0.7 + lerp * 0.5)) : 0;
    mat.opacity += (target - mat.opacity) * Math.min(1, dt * 2.4);
    m.visible = mat.opacity > 0.04;
    const drift = windSpeed * dt * (1.6 + idx * 0.35);
    m.position.x += Math.cos(windDir + phase) * drift;
    m.position.z += Math.sin(windDir + phase) * drift;
    m.position.x = ((m.position.x + 140) % 280) - 140;
    m.position.z = ((m.position.z + 140) % 280) - 140;
  });
  const shallowMat = sys.shallowPlane.material as THREE.MeshStandardMaterial;
  const shallowTarget = zone === "shallow" ? 0.22 + lerp * 0.14 : zone === "wet_shore" ? 0.12 : 0;
  shallowMat.opacity += (shallowTarget - shallowMat.opacity) * Math.min(1, dt * 1.6);
  sys.shallowPlane.visible = shallowMat.opacity > 0.02;
  shallowMat.color.setHSL(0.56 + lerp * 0.02, 0.48, 0.52 + lerp * 0.06);
  const mat = sys.mistPoints.material as THREE.PointsMaterial;
  const mistTarget = inCoastal && isStorm ? Math.min(0.42, base * 0.52) : zone === "wet_shore" ? 0.12 : 0;
  mat.opacity += (mistTarget - mat.opacity) * Math.min(1, dt * 1.8);
  sys.mistPoints.visible = mat.opacity > 0.04;
  if (sys.mistPoints.visible) {
    const pos = sys.mistPoints.geometry.attributes.position as THREE.BufferAttribute;
    const vel = sys.mistPoints.geometry.attributes.vel as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + Math.cos(windDir) * vel.getX(i) * dt * (2.2 + windSpeed * 0.12);
      let y = pos.getY(i) + (0.18 + windSpeed * 0.02) * dt;
      let z = pos.getZ(i) + Math.sin(windDir) * vel.getX(i) * dt * (2.2 + windSpeed * 0.12);
      if (y > 8.2) { y = Math.random() * 1.2; x = (Math.random() - 0.5) * 80; z = (Math.random() - 0.5) * 80; }
      if (x > 40) x -= 80; if (x < -40) x += 80; if (z > 40) z -= 80; if (z < -40) z += 80;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  // R1.6 — River glint: visible near coast + low sun angle (sun reflection on water)
  const sun = sunAngle ?? 0.5;
  const glintTarget = inCoastal && sun < 0.35 ? 0.55 * (1 - sun / 0.35) : 0;
  const glintMat = sys.riverGlint.material as THREE.MeshBasicMaterial;
  glintMat.opacity += (glintTarget - glintMat.opacity) * Math.min(1, dt * 2);
  sys.riverGlint.visible = glintMat.opacity > 0.02;
  if (sys.riverGlint.visible) {
    sys.riverGlint.position.x += Math.cos(windDir) * 0.08;
    sys.riverGlint.position.z += Math.sin(windDir) * 0.08;
  }

  // R1.6 — Post-storm mist: lingers 15s after storm ends, fades slowly
  const psMat = sys.postStormMist.material as THREE.PointsMaterial;
  const psTarget = wasStorm && !isStorm ? 0.22 : 0;
  psMat.opacity += (psTarget - psMat.opacity) * Math.min(1, dt * 0.15); // slow fade
  sys.postStormMist.visible = psMat.opacity > 0.01;
  if (sys.postStormMist.visible) {
    const psPos = sys.postStormMist.geometry.attributes.position as THREE.BufferAttribute;
    const psVel = sys.postStormMist.geometry.attributes.vel as THREE.BufferAttribute;
    for (let i = 0; i < psPos.count; i++) {
      let x = psPos.getX(i) + Math.cos(windDir) * psVel.getX(i) * dt * 0.6;
      let y = psPos.getY(i) + 0.06 * dt;
      let z = psPos.getZ(i) + Math.sin(windDir) * psVel.getX(i) * dt * 0.6;
      if (y > 6) { y = 0; x = (Math.random() - 0.5) * 120; z = (Math.random() - 0.5) * 120; }
      psPos.setXYZ(i, x, y, z);
    }
    psPos.needsUpdate = true;
  }
}

export function disposeCoastal(sys: CoastalSystem): void {
  sys.foamMeshes.forEach(m => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
  sys.mistPoints.geometry.dispose();
  (sys.mistPoints.material as THREE.Material).dispose();
  sys.shallowPlane.geometry.dispose();
  (sys.shallowPlane.material as THREE.Material).dispose();
  sys.riverGlint.geometry.dispose();
  (sys.riverGlint.material as THREE.Material).dispose();
  sys.postStormMist.geometry.dispose();
  (sys.postStormMist.material as THREE.Material).dispose();
}
