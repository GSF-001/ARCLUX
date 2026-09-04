// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/ark.ts — ARK-LIBRARIESCHIP §18.5: vessel-world procedural AAA+
// stadium megastructure Fase 3 (12 komponen, 4 ring industri via
// InstancedMesh, EVE/Star Citizen scale). BUKAN generic vessel — construction
// logic-nya jauh lebih kompleks, modul sendiri. Moved verbatim dari scene3d.ts.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext } from "./bootstrap";
import { makeGlowTexture } from "./bootstrap";

export interface ArkBuildResult {
  group: THREE.Group;
  rings: THREE.Mesh[];
  ringGroups: THREE.Group[];
  engines: THREE.Sprite[];
  shields: { mesh: THREE.Mesh; sprite: THREE.Sprite }[];
  antennas: THREE.Mesh[];
  habitatMeshes: THREE.InstancedMesh[];
  windowMeshes: THREE.InstancedMesh[];
}

export function buildArkLibrary(): ArkBuildResult {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), metalness: 0.74, roughness: 0.38, emissive: threeColor("#0a1424"), emissiveIntensity: 0.35 });
  const steelHigh = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.76, roughness: 0.32 });
  const amber = new THREE.MeshStandardMaterial({ color: threeColor(colors.tactical), emissive: threeColor(colors.tactical), emissiveIntensity: 1.4 });
  const tech = new THREE.MeshStandardMaterial({ color: threeColor(colors.tech), emissive: threeColor(colors.tech), emissiveIntensity: 1.2 });
  const windowWarmMat = new THREE.MeshStandardMaterial({ color: threeColor("#ffd9a0"), emissive: threeColor("#ffd9a0"), emissiveIntensity: 1.8 });
  const habitatMat = new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), metalness: 0.72, roughness: 0.4, emissive: threeColor("#ffb36b"), emissiveIntensity: 0.45 });

  const rings: THREE.Mesh[] = [];
  const ringGroups: THREE.Group[] = [];
  const engines: THREE.Sprite[] = [];
  const shields: { mesh: THREE.Mesh; sprite: THREE.Sprite }[] = [];
  const antennas: THREE.Mesh[] = [];
  const habitatMeshes: THREE.InstancedMesh[] = [];
  const windowMeshes: THREE.InstancedMesh[] = [];

  // 1) KEEL — spine + 12 panel lines + 8 window strips (hard-surface)
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(320, 380, 4200, 48), steel);
  keel.rotation.z = Math.PI / 2;
  g.add(keel);
  for (let i = 0; i < 12; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3800, 1.2, 6), steelHigh);
    panel.position.set(0, 310 + (i % 3) * 22 * (i < 6 ? 1 : -1), -30 + (i % 4) * 14);
    panel.rotation.z = Math.PI / 2;
    panel.rotation.y = (i / 12) * Math.PI * 0.08;
    g.add(panel);
  }
  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(180, 4, 2), windowWarmMat);
    win.position.set(-1600 + i * 460, 205, 0);
    g.add(win);
  }

  // 2) PROW + COCKPIT DOME + sensor array
  const prow = new THREE.Mesh(new THREE.ConeGeometry(200, 1100, 40), steelHigh);
  prow.rotation.z = -Math.PI / 2;
  prow.position.x = 2400;
  g.add(prow);
  const cockpitDome = new THREE.Mesh(
    new THREE.SphereGeometry(42, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshPhysicalMaterial({ color: threeColor("#a8d8ff"), metalness: 0.04, roughness: 0.07, transmission: 0.82, thickness: 1.1, ior: 1.45, transparent: true, opacity: 0.9, envMapIntensity: 1.3 })
  );
  cockpitDome.position.set(2100, 115, 0);
  cockpitDome.scale.set(1.4, 0.8, 1.2);
  g.add(cockpitDome);
  for (let i = 0; i < 3; i++) {
    const sens = new THREE.Mesh(new THREE.CylinderGeometry(4 + i, 6 + i, 18, 8), steelHigh);
    sens.rotation.x = Math.PI / 2;
    sens.position.set(2920 + i * 14, (i - 1) * 18, 0);
    g.add(sens);
  }

  // 3) STERN + ENGINE HOUSING (4 nacelles) + exhaust ports + glow
  const stern = new THREE.Mesh(new THREE.SphereGeometry(360, 40, 40), steel);
  stern.position.x = -2300;
  g.add(stern);
  const enginePositions = [[-2520, 110, 110], [-2520, 110, -110], [-2520, -110, 110], [-2520, -110, -110]] as const;
  for (const [x, y, z] of enginePositions) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(62, 82, 220, 20), steelHigh);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(x, y, z);
    g.add(housing);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: threeColor("#ff6a1a"), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(x - 140, y, z);
    glow.scale.set(180, 180, 1);
    g.add(glow);
    engines.push(glow);
  }
  for (let i = 0; i < 8; i++) {
    const port = new THREE.Mesh(new THREE.ConeGeometry(10, 18, 6), amber);
    port.rotation.z = Math.PI / 2;
    const ang = (i / 8) * Math.PI * 2;
    port.position.set(-2300 + Math.cos(ang) * 280, Math.sin(ang) * 280, Math.cos(ang * 2) * 40);
    port.lookAt(-2300, 0, 0);
    g.add(port);
  }

  // 4) SPIRE + observation deck + antenna + dish + light strip
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(90, 220, 1100, 36), steelHigh);
  spire.position.y = 700;
  g.add(spire);
  const spireCap = new THREE.Mesh(new THREE.ConeGeometry(120, 260, 36), amber);
  spireCap.position.y = 1380;
  g.add(spireCap);
  const obsDeck = new THREE.Mesh(new THREE.TorusGeometry(160, 22, 14, 40), steelHigh);
  obsDeck.rotation.x = Math.PI / 2;
  obsDeck.position.y = 860;
  g.add(obsDeck);
  const lightStrip = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1080, 8), amber);
  lightStrip.position.y = 700;
  g.add(lightStrip);
  for (let i = 0; i < 4; i++) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 220 + i * 70, 6), steelHigh);
    ant.position.set((i - 1.5) * 28, 1520 + i * 12, 0);
    g.add(ant);
    antennas.push(ant);
    if (i === 2) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), steelHigh);
      dish.position.set((i - 1.5) * 28, 1650, 0);
      dish.rotation.x = Math.PI / 2;
      g.add(dish);
    }
  }

  // 5) RINGS — stadium megastructure (4×) — full industri via InstancedMesh
  const ringDummy = new THREE.Object3D();
  for (let r = 0; r < 4; r++) {
    const rg = new THREE.Group();
    const radius = 640 + r * 46;
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 26, 16, 72), r === 1 ? amber : steelHigh);
    ringMesh.rotation.x = 1.2 + r * 0.08;
    ringMesh.position.x = -400 + r * 500;
    rg.add(ringMesh);
    rings.push(ringMesh);

    // 5a) 8 support struts per ring
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 420), steelHigh);
      const sx = (-400 + r * 500) + Math.cos(ang) * radius * 0.5;
      const sy = Math.sin(ang) * radius * 0.5;
      strut.position.set(sx * 0.2, sy, Math.sin(ang) * 60);
      strut.lookAt(-400 + r * 500, 0, 0);
      rg.add(strut);
    }

    // 5b) Ring glow sprite + ambient light
    const ringGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: threeColor(r === 2 ? colors.glowStation : colors.glowEngine),
      transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    ringGlow.position.set(-400 + r * 500, 0, 0);
    ringGlow.scale.set(340, 340, 1);
    rg.add(ringGlow);

    // 5c) 24 habitat modules per ring — InstancedMesh
    {
      const habGeom = new THREE.BoxGeometry(30, 18, 26);
      const habMesh = new THREE.InstancedMesh(habGeom, habitatMat, 24);
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        ringDummy.position.set((-400 + r * 500) + Math.cos(ang) * (radius - 12), Math.sin(ang) * (radius - 12), 0);
        ringDummy.rotation.set(0, 0, ang + Math.PI / 2);
        ringDummy.updateMatrix();
        habMesh.setMatrixAt(i, ringDummy.matrix);
      }
      habMesh.instanceMatrix.needsUpdate = true;
      rg.add(habMesh);
      habitatMeshes.push(habMesh);
    }

    // 5d) 12 docking bay ports per ring
    for (let d = 0; d < 12; d++) {
      const ang = (d / 12) * Math.PI * 2;
      const port = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.TorusGeometry(16, 2.2, 8, 20, Math.PI), amber);
      frame.rotation.y = Math.PI / 2;
      const inner = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 8), new THREE.MeshStandardMaterial({ color: threeColor("#060a12"), roughness: 1 }));
      inner.position.x = 4;
      port.add(frame, inner);
      // marker light
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: threeColor(colors.tactical), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      marker.position.set(0, 14, 0);
      marker.scale.set(10, 10, 1);
      port.add(marker);
      port.position.set((-400 + r * 500) + Math.cos(ang) * (radius + 18), Math.sin(ang) * (radius + 18), 0);
      port.lookAt((-400 + r * 500) + Math.cos(ang) * (radius + 40), Math.sin(ang) * (radius + 40), 0);
      // bay door — 2 panels
      const doorL = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 9), steelHigh);
      doorL.position.set(0, 6, 4);
      const doorR = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 9), steelHigh);
      doorR.position.set(0, -6, 4);
      port.add(doorL, doorR);
      rg.add(port);
    }

    // 5e) 4 maintenance platforms per ring — flat deck + guard rail + hazard stripe
    for (let p = 0; p < 4; p++) {
      const ang = (p / 4) * Math.PI * 2 + 0.2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(80, 3, 42), steelHigh);
      deck.position.set((-400 + r * 500) + Math.cos(ang) * (radius + 26), Math.sin(ang) * (radius + 26), 0);
      deck.rotation.z = ang;
      rg.add(deck);
      for (let k = 0; k < 2; k++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(76, 1.2, 1.2), steelHigh);
        rail.position.set(deck.position.x, deck.position.y + (k ? 6 : -6), deck.position.z + 18);
        rail.rotation.z = ang;
        rg.add(rail);
      }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(78, 0.6, 2), amber);
      stripe.position.set(deck.position.x, deck.position.y, deck.position.z + 19);
      stripe.rotation.z = ang;
      rg.add(stripe);
    }

    // 5f) 96 glowing windows per ring — InstancedMesh warm
    {
      const winGeom = new THREE.BoxGeometry(4.2, 2.6, 0.8);
      const winMesh = new THREE.InstancedMesh(winGeom, windowWarmMat, 96);
      for (let w = 0; w < 96; w++) {
        const ang = (w / 96) * Math.PI * 2 + (w % 2) * 0.02;
        const radJ = radius + (w % 3) * 4 - 4;
        ringDummy.position.set((-400 + r * 500) + Math.cos(ang) * radJ, Math.sin(ang) * radJ, (w % 2 ? 6 : -6));
        ringDummy.rotation.set(0, 0, ang);
        ringDummy.scale.set(1, 1, 1);
        ringDummy.updateMatrix();
        winMesh.setMatrixAt(w, ringDummy.matrix);
      }
      winMesh.instanceMatrix.needsUpdate = true;
      rg.add(winMesh);
      windowMeshes.push(winMesh);
    }

    g.add(rg);
    ringGroups.push(rg);
  }

  // 6) SPARS 6× — light strips + cross-bracing X
  for (let i = 0; i < 6; i++) {
    const x = -1000 + i * 400;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(140, 30, 1200), steelHigh);
    spar.position.set(x, 0, 0);
    spar.rotation.y = Math.PI / 2;
    g.add(spar);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(138, 0.8, 2), amber);
    strip.position.set(x, 16, 0);
    strip.rotation.y = Math.PI / 2;
    g.add(strip);
    for (let k = 0; k < 2; k++) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1200), steelHigh);
      brace.position.set(x, 0, 0);
      brace.rotation.y = Math.PI / 2;
      brace.rotation.z = k ? 0.35 : -0.35;
      g.add(brace);
    }
  }

  // 7) WEAPON MOUNTS 4× — box + barrel
  const mountPositions = [[600, 90, 180], [600, 90, -180], [-300, -90, 180], [-300, -90, -180]] as const;
  for (const [x, y, z] of mountPositions) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(15, 8, 40), steelHigh);
    mount.position.set(x, y, z);
    g.add(mount);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 8), amber);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(x, y, z - 32);
    g.add(barrel);
  }

  // 8) DOCKING BAY — opening di hull tengah
  const bayFrame = new THREE.Mesh(new THREE.BoxGeometry(124, 84, 6), amber);
  bayFrame.position.set(200, -140, 0);
  g.add(bayFrame);
  const bayInner = new THREE.Mesh(new THREE.BoxGeometry(120, 80, 200), new THREE.MeshStandardMaterial({ color: threeColor("#04070d"), roughness: 1, metalness: 0 }));
  bayInner.position.set(200, -140, 40);
  g.add(bayInner);
  for (let k = 0; k < 2; k++) {
    const doorLine = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 1), steelHigh);
    doorLine.position.set(200 + (k ? 30 : -30), -140 + (k ? 38 : -38), -2);
    g.add(doorLine);
  }

  // 9) CARGO PODS 4× — bawah hull + struts
  for (let i = 0; i < 4; i++) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(50, 40, 80), steel);
    pod.position.set(-800 + i * 520, -210, 0);
    g.add(pod);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 80, 6), steelHigh);
    strut.position.set(-800 + i * 520, -160, 0);
    g.add(strut);
  }

  // 10) ANTENNA ARRAYS 6× — thin + dish di 2
  for (let i = 0; i < 6; i++) {
    const h = 220 + (i % 3) * 90;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, h, 6), steelHigh);
    ant.position.set(-900 + i * 360, 380 + h / 2, (i % 2 ? 1 : -1) * 90);
    g.add(ant);
    antennas.push(ant);
    if (i === 1 || i === 4) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(20, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), steelHigh);
      dish.position.set(-900 + i * 360, 380 + h + 12, (i % 2 ? 1 : -1) * 90);
      dish.rotation.x = Math.PI / 2;
      g.add(dish);
    }
  }

  // 11) SHIELD GENERATORS 6× — perimeter + glow + pulse
  const shieldPos = [[900, 160, 0], [0, 160, 220], [-800, 160, 0], [900, -160, 0], [0, -160, -220], [-800, -160, 0]] as const;
  for (let i = 0; i < shieldPos.length; i++) {
    const [x, y, z] = shieldPos[i];
    const gen = new THREE.Mesh(new THREE.SphereGeometry(15, 12, 10), tech);
    gen.position.set(x, y, z);
    g.add(gen);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: threeColor(colors.tech), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(x, y, z);
    glow.scale.set(38, 38, 1);
    g.add(glow);
    shields.push({ mesh: gen, sprite: glow });
  }

  // 12) OBSERVATORY DOME — atas hull tengah + internal structure
  const obs = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshPhysicalMaterial({ color: threeColor("#c8e8ff"), metalness: 0.02, roughness: 0.06, transmission: 0.74, thickness: 0.9, transparent: true, opacity: 0.92 }));
  obs.position.set(400, 210, 0);
  g.add(obs);
  const obsInner = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 18), steelHigh);
  obsInner.position.set(400, 210, 0);
  g.add(obsInner);

  return { group: g, rings, ringGroups, engines, shields, antennas, habitatMeshes, windowMeshes };
}

/** Pasang Ark di scene + simpan ref animasi di ctx (posisi vessel-world). */
export function buildArk(ctx: SceneContext): void {
  const arkBuild = buildArkLibrary();
  const ark = arkBuild.group;
  ark.position.set(-32000, -2000, 3000);
  ctx.scene.add(ark);
  // Ark animation refs — dipakai updateArk (ring rotation, engine/shield pulse, antenna sway)
  ctx.ark = {
    group: ark,
    rings: arkBuild.rings,
    ringGroups: arkBuild.ringGroups,
    engines: arkBuild.engines,
    shields: arkBuild.shields,
    antennas: arkBuild.antennas,
  };
}

/** Animasi Ark per frame — ring beda arah + engine/shield pulse + sway. */
export function updateArk(ctx: SceneContext, t: number): void {
  const ark = ctx.ark;
  if (!ark) return;
  const arkRingGroups = ark.ringGroups;
  const arkEngines = ark.engines;
  const arkShields = ark.shields;
  const arkAntennas = ark.antennas;
  // Ark — stadium megastructure animation (Fase 3) — ring rotasi beda arah + engine/shield pulse + antenna sway
  // Rings: 1:+0.001, 2:-0.0015, 3:+0.002, 4:-0.0008 per frame (60fps ~ 0.06/0.09/0.12/0.048 rad/s)
  // Habitat/windows/ports/platforms jadi child dari ringGroups (rg) jadi ikut rotasi group
  if (arkRingGroups.length === 4) {
    arkRingGroups[0].rotation.y += 0.001;
    arkRingGroups[1].rotation.y -= 0.0015;
    arkRingGroups[2].rotation.y += 0.002;
    arkRingGroups[3].rotation.y -= 0.0008;
  }
  for (let i = 0; i < arkEngines.length; i++) {
    arkEngines[i].material.opacity = 0.62 + 0.32 * Math.sin(t * 0.003 + i * 1.1);
    arkEngines[i].material.needsUpdate = true;
  }
  for (let i = 0; i < arkShields.length; i++) {
    const pulse = 0.42 + 0.38 * Math.sin(t * 0.002 + i * 0.9);
    arkShields[i].sprite.material.opacity = pulse;
    (arkShields[i].mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55 + pulse * 0.9;
  }
  for (let i = 0; i < arkAntennas.length; i++) {
    arkAntennas[i].rotation.z = Math.sin(t * 0.0005 + i) * 0.022;
  }
}
