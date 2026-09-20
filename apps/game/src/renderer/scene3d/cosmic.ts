// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/cosmic.ts — meteor shower / star flare / aurora §2.4 (bergerak).
// Moved verbatim dari scene3d.ts. Aurora pakai nebulaTex dari ctx (dibuat
// nebula.ts duluan — dependency sebagai data).

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext } from "./bootstrap";

/** Meteor + 2 aurora sprite — state di ctx (updateCosmic per frame). */
export function buildCosmic(ctx: SceneContext): void {
  const { scene, nebulaTex } = ctx;
  ctx.meteorMat = new THREE.LineBasicMaterial({ color: threeColor(colors.meteorTrail), transparent: true, opacity: 0.9 });
  const auroraMat = new THREE.SpriteMaterial({
    map: nebulaTex, color: threeColor(colors.auroraA), transparent: true, opacity: 0.14,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  ctx.auroraSpr = new THREE.Sprite(auroraMat);
  ctx.auroraSpr.scale.set(90000, 26000, 1);
  ctx.auroraSpr.position.set(-20000, 22000, -40000);
  scene.add(ctx.auroraSpr);
  const auroraMatB = new THREE.SpriteMaterial({
    map: nebulaTex, color: threeColor(colors.auroraB), transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  ctx.auroraSprB = new THREE.Sprite(auroraMatB);
  ctx.auroraSprB.scale.set(70000, 20000, 1);
  ctx.auroraSprB.position.set(22000, 24000, -46000);
  scene.add(ctx.auroraSprB);
}

export function spawnMeteor(ctx: SceneContext): void {
  const { scene, rand, meteors, meteorMat } = ctx;
  if (meteors.length > 60 || !meteorMat) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(g, meteorMat);
  const start = new THREE.Vector3(
    (rand() - 0.5) * 80000, 8000 + rand() * 20000, -(rand() + 1) * 60000
  );
  const v = new THREE.Vector3(1200 + rand() * 2000, -(200 + rand() * 600), 2600 + rand() * 3000);
  scene.add(line);
  meteors.push({ line, start, v, life: 0, ttl: 1.2 + rand() * 1.8 });
  updateMeteorPos(line, start, v, 0);
}

export function updateMeteorPos(line: THREE.Line, start: THREE.Vector3, v: THREE.Vector3, t: number): void {
  const attr = line.geometry.attributes.position as THREE.BufferAttribute;
  attr.setXYZ(0, start.x + v.x * t, start.y + v.y * t, start.z + v.z * t);
  attr.setXYZ(1, start.x + v.x * (t + 0.16), start.y + v.y * (t + 0.16), start.z + v.z * (t + 0.16));
  attr.needsUpdate = true;
}

/** Burst meteor + gerak + aurora pulse — dipanggil per frame. */
export function updateCosmic(ctx: SceneContext, t: number): void {
  const { scene, meteors, auroraSpr, auroraSprB } = ctx;
  // Meteor shower (§2.4) — spawning bursty & bergerak (peak saat "hujan").
  const burst = Math.sin(t * 0.0007) > 0.985 || Math.cos(t * 0.0009) > 0.995 ? 4 : 1;
  for (let i = 0; i < burst; i++) spawnMeteor(ctx);
  for (const m of meteors.slice()) {
    m.life += 1 / 60;
    m.ttl -= 1 / 60;
    updateMeteorPos(m.line, m.start, m.v, m.life);
    if (m.ttl <= 0) {
      scene.remove(m.line);
      m.line.geometry.dispose();
      meteors.splice(meteors.indexOf(m), 1);
    }
  }
  // Aurora — denyut halus (§2.4)
  if (auroraSpr) auroraSpr.material.opacity = 0.1 + 0.06 * Math.sin(t * 0.0002);
  if (auroraSprB) auroraSprB.material.opacity = 0.07 + 0.05 * Math.cos(t * 0.00025);
}

/** Hapus meteor hidup (dipakai dispose). */
export function disposeCosmic(ctx: SceneContext): void {
  for (const m of ctx.meteors) ctx.scene.remove(m.line);
  ctx.meteors.length = 0;
}

// ---------------------------------------------------------------------------
// R1.3 — Solar wind tint + anomaly gravity particles
// ---------------------------------------------------------------------------

export interface CosmicEventVisual {
  solarWindTint: THREE.Sprite | null;
  anomalyParticles: THREE.Points | null;
}

export function buildCosmicEventVisual(ctx: SceneContext): CosmicEventVisual {
  const { scene, nebulaTex } = ctx;

  // Solar wind — sky tint aurora-ish (aurora repurposed for solar wind mode)
  const solarWindMat = new THREE.SpriteMaterial({
    map: nebulaTex,
    color: 0x88ccff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const solarWind = new THREE.Sprite(solarWindMat);
  solarWind.scale.set(90000, 18000, 1);
  solarWind.position.set(0, 30000, -40000);
  solarWind.name = "solarWindTint";
  scene.add(solarWind);

  // Anomaly gravity — particle drift (32 particles in a cluster)
  const count = 32;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 6000;
    pos[i * 3 + 1] = Math.random() * 4000;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6000;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xaaffaa,
    size: 18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(geo, mat);
  particles.name = "anomalyParticles";
  particles.frustumCulled = false;
  scene.add(particles);

  return { solarWindTint: solarWind, anomalyParticles: particles };
}

export function tickCosmicEventVisual(
  vis: CosmicEventVisual,
  isSolarWind: boolean,
  isAnomaly: boolean,
  timeSec: number,
  cameraPos: { x: number; y: number; z: number },
): void {
  // R1.3 — Solar wind: sky tint aurora-ish, pulsing
  if (vis.solarWindTint) {
    const target = isSolarWind ? 0.12 + 0.06 * Math.sin(timeSec * 0.5) : 0;
    const mat = vis.solarWindTint.material as THREE.SpriteMaterial;
    mat.opacity += (target - mat.opacity) * 0.05;
    vis.solarWindTint.visible = mat.opacity > 0.01;
  }

  // R1.3 — Anomaly gravity: particle drift toward camera
  if (vis.anomalyParticles) {
    const mat = vis.anomalyParticles.material as THREE.PointsMaterial;
    const target = isAnomaly ? 0.35 : 0;
    mat.opacity += (target - mat.opacity) * 0.05;
    vis.anomalyParticles.visible = mat.opacity > 0.01;
    if (isAnomaly) {
      const pos = vis.anomalyParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + 8;
        if (y > 5000) y = 0;
        pos.setY(i, y);
        // Drift toward camera slowly
        const cx = pos.getX(i);
        const cz = pos.getZ(i);
        pos.setX(i, cx + (cameraPos.x - cx) * 0.0003);
        pos.setZ(i, cz + (cameraPos.z - cz) * 0.0003);
      }
      pos.needsUpdate = true;
      vis.anomalyParticles.position.set(cameraPos.x, 0, cameraPos.z);
    }
  }
}

export function disposeCosmicEventVisual(vis: CosmicEventVisual, scene: THREE.Scene): void {
  if (vis.solarWindTint) {
    scene.remove(vis.solarWindTint);
    (vis.solarWindTint.material as THREE.Material).dispose();
  }
  if (vis.anomalyParticles) {
    scene.remove(vis.anomalyParticles);
    vis.anomalyParticles.geometry.dispose();
    (vis.anomalyParticles.material as THREE.Material).dispose();
  }
}
