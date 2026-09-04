// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/explosions.ts — ledakan full particle Fase 4: 5 burst sprite
// (0.8s) + shield flash (0.2s) + 30 sparks (0.3s) + 12 debris (2s).
// Moved verbatim dari scene3d.ts. Trigger: renderRegion saat vessel mati
// + sfxHandler (di-set renderer via setSfxHandler).

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext } from "./bootstrap";
import { makeGlowTexture } from "./bootstrap";

export interface Explosion {
  burst: THREE.Sprite[];
  debris: THREE.Mesh[];
  debrisVel: THREE.Vector3[];
  sparks: THREE.Line[];
  sparkVel: THREE.Vector3[];
  flash: THREE.Sprite | null;
  pos: THREE.Vector3;
  t: number;
  ttlDebris: number;
}

/** Ledakan di posisi render — burst + debris + sparks + flash. */
export function spawnExplosion(ctx: SceneContext, pos: THREE.Vector3): void {
  const { scene, sfxHandler } = ctx;
  sfxHandler?.("explosion");
  const p = pos.clone();
  // 5 burst sprites — orange→red→dark, scale 20→200→0 over 0.8s
  const burstColors = ["#ff6a00", "#ff3a00", "#ff1a00", "#8a1a05", "#2a0a03"];
  const burst: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: new THREE.Color(burstColors[i]), transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    spr.position.copy(p);
    spr.position.x += (Math.random() - 0.5) * 8;
    spr.position.y += (Math.random() - 0.5) * 8;
    spr.position.z += (Math.random() - 0.5) * 8;
    spr.scale.set(20 + i * 6, 20 + i * 6, 1);
    scene.add(spr);
    burst.push(spr);
  }
  // 12 debris fragments — Box 2..5, velocity outward, gravity
  const debris: THREE.Mesh[] = [];
  const debrisVel: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const s = 2 + Math.random() * 3;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s),
      new THREE.MeshStandardMaterial({ color: threeColor(i % 3 ? colors.hullHigh : colors.hull), metalness: 0.5, roughness: 0.5, transparent: true, opacity: 1 }));
    m.position.copy(p);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(m);
    debris.push(m);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    debrisVel.push(dir.multiplyScalar(18 + Math.random() * 42));
  }
  // 30 sparks — Line 2 points, high velocity, fade 0.3s
  const sparks: THREE.Line[] = [];
  const sparkVel: THREE.Vector3[] = [];
  const sparkMatBase = new THREE.LineBasicMaterial({ color: threeColor("#ffd67a"), transparent: true, opacity: 1 });
  for (let i = 0; i < 30; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([p.x, p.y, p.z, p.x, p.y, p.z]), 3));
    const mat = sparkMatBase.clone();
    mat.color = new THREE.Color(`hsl(${28 + Math.random() * 18}, 100%, ${60 + Math.random() * 30}%)`);
    const line = new THREE.Line(g, mat);
    scene.add(line);
    sparks.push(line);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    sparkVel.push(dir.multiplyScalar(90 + Math.random() * 120));
  }
  // Shield flash — white additive 50→150→0 in 0.2s
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: new THREE.Color(0xffffff), transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flash.position.copy(p);
  flash.scale.set(50, 50, 1);
  scene.add(flash);
  ctx.explosions.push({ burst, debris, debrisVel, sparks, sparkVel, flash, pos: p, t: 0, ttlDebris: 2.0 });
}

/** Update semua ledakan hidup — dipanggil per frame (dt fixed 1/60). */
export function updateExplosions(ctx: SceneContext): void {
  const { scene, explosions } = ctx;
  // Fase 4 — explosion full particle update (burst 0.8s, sparks 0.3s, flash 0.2s, debris 2s)
  const dt = 1 / 60;
  for (let ei = explosions.length - 1; ei >= 0; ei--) {
    const ex = explosions[ei];
    ex.t += dt;
    const k = ex.t;
    // burst 5 sprites — scale 20→200, opacity 1→0 in 0.8s
    for (const s of ex.burst) {
      if (k <= 0.8) {
        const sc = 20 + (180 * k) / 0.8;
        s.scale.set(sc, sc, 1);
        (s.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k / 0.8);
      } else if (s.parent) {
        scene.remove(s);
      }
    }
    // shield flash 50→150 in 0.2s
    if (ex.flash) {
      if (k <= 0.2) {
        const sc = 50 + 500 * k;
        ex.flash.scale.set(sc, sc, 1);
        (ex.flash.material as THREE.SpriteMaterial).opacity = 0.95 * (1 - k / 0.2);
      } else {
        scene.remove(ex.flash);
        (ex.flash.material as THREE.SpriteMaterial).map?.dispose();
        (ex.flash.material as THREE.Material).dispose();
        ex.flash = null;
      }
    }
    // sparks 30 lines — high velocity, fade 0.3s
    for (let j = 0; j < ex.sparks.length; j++) {
      const line = ex.sparks[j];
      if (k > 0.3) {
        if (line.parent) scene.remove(line);
        continue;
      }
      const v = ex.sparkVel[j];
      const p0 = ex.pos.clone().add(v.clone().multiplyScalar(k));
      const p1 = p0.clone().add(v.clone().normalize().multiplyScalar(3.5));
      const attr = line.geometry.attributes.position as THREE.BufferAttribute;
      attr.setXYZ(0, p0.x, p0.y, p0.z);
      attr.setXYZ(1, p1.x, p1.y, p1.z);
      attr.needsUpdate = true;
      (line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - k / 0.3);
    }
    // debris 12 fragments — velocity outward + gravity, fade last 0.5s of 2s
    for (let j = 0; j < ex.debris.length; j++) {
      const m = ex.debris[j];
      const v = ex.debrisVel[j];
      m.position.add(v.clone().multiplyScalar(dt));
      v.y -= 18 * dt;
      m.rotation.x += dt * 2.4;
      m.rotation.y += dt * 1.8;
      m.rotation.z += dt * 1.1;
      if (k > 1.5) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.opacity = Math.max(0, 1 - (k - 1.5) / 0.5);
        mat.needsUpdate = true;
      }
    }
    // remove burst sprites after 0.8s (geometry already, just material cleanup at 2s)
    if (k > 0.8) {
      for (const s of ex.burst) if (s.parent) { scene.remove(s); }
    }
    // final cleanup after 2s — dispose debris + sparks + burst mats
    if (k > 2.0) {
      for (const s of ex.burst) {
        const mat = s.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
      for (const m of ex.debris) {
        scene.remove(m);
        m.geometry.dispose();
        const mat = m.material as THREE.Material;
        (mat as unknown as { map?: THREE.Texture }).map?.dispose?.();
        mat.dispose();
      }
      for (const line of ex.sparks) {
        if (line.parent) scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      explosions.splice(ei, 1);
    }
  }
}

/** Dispose paksa semua ledakan (dipakai dispose global). */
export function disposeExplosions(ctx: SceneContext): void {
  const { scene, explosions } = ctx;
  for (const ex of explosions) {
    for (const s of ex.burst) { if (s.parent) scene.remove(s); (s.material as THREE.Material).dispose(); }
    if (ex.flash && ex.flash.parent) scene.remove(ex.flash);
    if (ex.flash) (ex.flash.material as THREE.Material).dispose();
    for (const mm of ex.debris) { scene.remove(mm); mm.geometry.dispose(); (mm.material as THREE.Material).dispose(); }
    for (const line of ex.sparks) { scene.remove(line); line.geometry.dispose(); (line.material as THREE.Material).dispose(); }
  }
  explosions.length = 0;
}
