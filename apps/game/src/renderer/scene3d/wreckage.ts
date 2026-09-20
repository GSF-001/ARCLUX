// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/wreckage.ts — R1.2 Wreckage visual: carcass variant (dark, panels
// missing, tilt) + persistent smoke + SOS beacon blink + plaque when near.
// Blueprint 01 §18 "tetap dapat ditemukan fisik".

import * as THREE from "three";
import { makeGlowTexture } from "./bootstrap";

export interface WreckageState {
  group: THREE.Group;
  smoke: THREE.Points;
  sosBeacon: THREE.PointLight;
  sosSprite: THREE.Sprite;
  plaqueMesh: THREE.Mesh;
}

export function createWreckage(opts: {
  position: { x: number; y: number; z: number };
  name: string;
  battle: string;
  recovered: string;
}): WreckageState {
  const g = new THREE.Group();
  g.name = `wreckage-${opts.name}`;
  g.position.set(opts.position.x, opts.position.y, opts.position.z);

  const carcassMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e, roughness: 0.85, metalness: 0.4,
    emissive: 0x0a0a14, emissiveIntensity: 0.2,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(60, 16, 24), carcassMat);
  body.rotation.z = 0.15;
  body.rotation.y = 0.3;
  body.position.y = 4;
  g.add(body);

  const gapMat = new THREE.MeshStandardMaterial({ color: 0x060610, roughness: 1 });
  const gap1 = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 1), gapMat);
  gap1.position.set(10, 6, 13);
  gap1.rotation.y = 0.3;
  g.add(gap1);
  const gap2 = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 1), gapMat);
  gap2.position.set(-15, 8, -13);
  gap2.rotation.y = 0.3;
  g.add(gap2);

  const smokeCount = 24;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeVel = new Float32Array(smokeCount);
  for (let i = 0; i < smokeCount; i++) {
    smokePos[i * 3] = (Math.random() - 0.5) * 16;
    smokePos[i * 3 + 1] = Math.random() * 20 + 4;
    smokePos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    smokeVel[i] = 0.3 + Math.random() * 0.6;
  }
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute("vel", new THREE.BufferAttribute(smokeVel, 1));
  const smokeMat = new THREE.PointsMaterial({
    color: 0x4a4a5a, size: 2.5, transparent: true, opacity: 0.3,
    depthWrite: false, sizeAttenuation: true,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.name = "wreckageSmoke";
  smoke.frustumCulled = false;
  g.add(smoke);

  const sosBeacon = new THREE.PointLight(0xff2244, 0, 80, 2);
  sosBeacon.position.set(0, 14, 0);
  g.add(sosBeacon as unknown as THREE.Object3D);

  const sosGlowTex = makeGlowTexture();
  const sosSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sosGlowTex, color: 0xff2244, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sosSprite.scale.set(12, 12, 1);
  sosSprite.position.set(0, 14, 0);
  g.add(sosSprite);

  const plaqueCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  let plaqueMesh: THREE.Mesh;
  if (plaqueCanvas) {
    plaqueCanvas.width = 256;
    plaqueCanvas.height = 128;
    const pctx = plaqueCanvas.getContext("2d")!;
    pctx.fillStyle = "rgba(0,0,0,0.75)";
    pctx.fillRect(0, 0, 256, 128);
    pctx.font = "bold 18px monospace";
    pctx.fillStyle = "#aabbcc";
    pctx.textAlign = "center";
    pctx.fillText(opts.name, 128, 30);
    pctx.font = "14px monospace";
    pctx.fillStyle = "#8899aa";
    pctx.fillText(opts.battle, 128, 60);
    pctx.fillText(opts.recovered, 128, 85);
    pctx.fillText("[RECOVERED]", 128, 112);
    const tex = new THREE.CanvasTexture(plaqueCanvas);
    plaqueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 10),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
  } else {
    plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  }
  plaqueMesh.position.set(0, 18, 0);
  plaqueMesh.rotation.x = -0.3;
  plaqueMesh.name = "wreckagePlaque";
  g.add(plaqueMesh);

  return { group: g, smoke, sosBeacon, sosSprite, plaqueMesh };
}

export function tickWreckage(state: WreckageState, timeSec: number, cameraDist: number): void {
  const sPos = state.smoke.geometry.attributes.position as THREE.BufferAttribute;
  const sVel = state.smoke.geometry.attributes.vel as THREE.BufferAttribute;
  for (let i = 0; i < sPos.count; i++) {
    let y = sPos.getY(i) + sVel.getX(i) * 0.6;
    let x = sPos.getX(i) + Math.sin(timeSec + i) * 0.15;
    if (y > 28) { y = 4; x = (Math.random() - 0.5) * 16; sPos.setZ(i, (Math.random() - 0.5) * 16); }
    sPos.setX(i, x);
    sPos.setY(i, y);
  }
  sPos.needsUpdate = true;

  const blink = (timeSec % 4) < 3 ? 2.2 : 0;
  state.sosBeacon.intensity = blink;
  (state.sosSprite.material as THREE.SpriteMaterial).opacity = blink > 0 ? 0.7 : 0;

  const plaqueMat = state.plaqueMesh.material as THREE.MeshBasicMaterial;
  const plaqueTarget = cameraDist < 120 ? 0.85 : 0;
  plaqueMat.opacity += (plaqueTarget - plaqueMat.opacity) * 0.08;
  state.plaqueMesh.visible = plaqueMat.opacity > 0.02;
}

export function disposeWreckage(state: WreckageState): void {
  state.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | undefined;
    if (mat) mat.dispose();
  });
}
