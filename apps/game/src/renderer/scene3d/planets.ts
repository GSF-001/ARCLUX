// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/planets.ts — planet + moon + ring (§2.1/§2.3), backdrop planets
// (§2.2 sense of scale), cloud AAA+ visual-only, termal ∝ 1/r² (§2.6).
// Moved verbatim dari scene3d.ts.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext } from "./bootstrap";
import { mulberry32 } from "./rng";
import { keplerPosition } from "./orbital";

export type PlanetKind = "gasGiant" | "gasGiantRinged" | "ice" | "ocean" | "desert" | "volcanic";

export interface PlanetSpec {
  kind: PlanetKind;
  baseColor: string;
  emissive: string;
  roughness: number;
  metalness: number;
  /** yang menyusun ring (Torus) — hanya gas giant ringed. */
  hasRing?: boolean;
  moons: number;
}

export const PLANET_CATALOG: PlanetSpec[] = [
  { kind: "gasGiant", baseColor: colors.planetGasGiant, emissive: "#000000", roughness: 0.9, metalness: 0.0, moons: 2 },
  { kind: "gasGiantRinged", baseColor: colors.planetGasGiant, emissive: "#5a3a1a", roughness: 0.85, metalness: 0.1, hasRing: true, moons: 3 },
  { kind: "ice", baseColor: colors.planetIce, emissive: "#000000", roughness: 0.3, metalness: 0.5, moons: 1 },
  { kind: "ocean", baseColor: colors.planetOcean, emissive: "#000000", roughness: 0.2, metalness: 0.4, moons: 1 },
  { kind: "desert", baseColor: colors.planetDesert, emissive: "#000000", roughness: 0.95, metalness: 0.05, moons: 0 },
  { kind: "volcanic", baseColor: colors.planetLava, emissive: colors.lavaGlow, roughness: 0.8, metalness: 0.3, moons: 0 },
];

export interface Planet3D {
  mesh: THREE.Mesh;
  atmo: THREE.Sprite;
  atmoMat: THREE.SpriteMaterial;
  emissiveBase: number;
  orbit: import("./orbital").OrbitSpec;
  radius: number;
  spec: PlanetSpec;
  ring?: THREE.Mesh;
  cloud?: THREE.Mesh;
  cloudMat?: THREE.MeshStandardMaterial;
  moons: { mesh: THREE.Mesh; orbit: import("./orbital").OrbitSpec }[];
  baseColor: THREE.Color;
}

// AAA+ cloud texture — procedural canvas, per-kind, shared 1 tex per kind (512² = 1 MB)
// Gas giant = banded, ocean = swirl, ice = wispy, desert = dust, volcanic = ash
export function makeCloudTexture(kind: PlanetKind, size = 512): THREE.Texture {
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!canvas) return new THREE.Texture();
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  // seed per kind — deterministic
  const seedMap: Record<string, number> = { gasGiant: 0x5a2d, gasGiantRinged: 0x5a2e, ice: 0x1ce7, ocean: 0x0cea, desert: 0xde57, volcanic: 0x70fc };
  const rnd = mulberry32(seedMap[kind] ?? 0x1234);
  // base
  if (kind === "gasGiant" || kind === "gasGiantRinged") {
    // banded stripes
    for (let y = 0; y < size; y += 6 + (rnd() * 8 | 0)) {
      const h = 4 + rnd() * 10;
      const alpha = 0.22 + rnd() * 0.28;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, y, size, h);
      // waviness
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < size; x += 8) {
        const wy = y + Math.sin(x * 0.02 + rnd() * 6) * 3;
        if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    // storms
    for (let i = 0; i < 7; i++) {
      const x = rnd() * size, y = rnd() * size, rx = 18 + rnd() * 36, ry = 10 + rnd() * 18;
      ctx.fillStyle = `rgba(255,245,230,${0.18 + rnd() * 0.18})`;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rnd() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === "ocean") {
    // swirl clouds — Earth-like
    for (let i = 0; i < 180; i++) {
      const x = rnd() * size, y = rnd() * size, r = 12 + rnd() * 38;
      const a = 0.14 + rnd() * 0.22;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      // second lobe for wispy
      if (rnd() > 0.6) {
        ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
        ctx.beginPath(); ctx.arc(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, r * 0.7, 0, Math.PI * 2); ctx.fill();
      }
    }
    // soft blur via globalCompositeOperation lighter
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 60; i++) {
      const x = rnd() * size, y = rnd() * size, r = 22 + rnd() * 28;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.18)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  } else if (kind === "ice") {
    for (let i = 0; i < 120; i++) {
      const x = rnd() * size, y = rnd() * size, r = 10 + rnd() * 22;
      ctx.fillStyle = `rgba(255,255,255,${0.10 + rnd() * 0.14})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === "desert") {
    for (let y = 0; y < size; y += 4) {
      const a = 0.08 + rnd() * 0.12;
      ctx.fillStyle = `rgba(255,240,210,${a})`;
      ctx.fillRect(0, y, size, 1 + rnd() * 2);
    }
    for (let i = 0; i < 50; i++) {
      const x = rnd() * size, y = rnd() * size, r = 14 + rnd() * 26;
      ctx.fillStyle = `rgba(255,235,200,${0.10 + rnd() * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else { // volcanic
    for (let i = 0; i < 90; i++) {
      const x = rnd() * size, y = rnd() * size, r = 16 + rnd() * 30;
      ctx.fillStyle = `rgba(120,90,70,${0.14 + rnd() * 0.16})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      const x = rnd() * size, y = rnd() * size, r = 20 + rnd() * 32;
      ctx.fillStyle = `rgba(255,160,90,${0.08 + rnd() * 0.10})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** (Re)build sistem planet + moon + ring + cloud — dispose aman tiap rebuild. */
export function buildPlanetSystem(ctx: SceneContext, count: number, detail: number): void {
  const { scene, planets } = ctx;
  const coronaTex = ctx.coronaTex;
  for (const p of planets) {
    // cloud is child of mesh — remove via mesh.remove, dispose separately
    if (p.cloud) { p.mesh.remove(p.cloud); p.cloud.geometry.dispose(); p.cloudMat?.map?.dispose(); p.cloudMat?.dispose(); }
    scene.remove(p.mesh); scene.remove(p.atmo); if (p.ring) scene.remove(p.ring);
    for (const m of p.moons) scene.remove(m.mesh);
    (p.mesh.material as THREE.Material).dispose();
    if (p.ring) (p.ring.material as THREE.Material).dispose();
    for (const m of p.moons) (m.mesh.material as THREE.Material).dispose();
  }
  planets.length = 0;

  const radii = [1800, 1450, 1100, 900, 780, 640, 520, 420, 320];
  for (let i = 0; i < count; i++) {
    const spec = PLANET_CATALOG[i % PLANET_CATALOG.length];
    const radius = radii[Math.min(i, radii.length - 1) - (i >= count ? count - 1 : 0)];
    const seg = Math.max(16, detail);
    const geom = new THREE.SphereGeometry(radius, seg, seg);
    const mat = new THREE.MeshStandardMaterial({
      color: threeColor(spec.baseColor),
      emissive: threeColor(spec.emissive),
      emissiveIntensity: spec.kind === "volcanic" ? 1.1 : 0.15,
      roughness: spec.roughness,
      metalness: spec.metalness,
    });
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    // Atmosfer (ATMOSPHERIC §2.2) — rim glow
    const atmoMat = new THREE.SpriteMaterial({
      map: coronaTex, color: threeColor(spec.baseColor), transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const atmo = new THREE.Sprite(atmoMat);
    atmo.scale.set(radius * 3.6, radius * 3.6, 1);
    mesh.add(atmo);

    // AAA+ Cloud layer — visual-only (D-019 imun, gak masuk Environs/WorldRegion), di semua planet
    const cloudOpacity: Record<PlanetKind, number> = { gasGiant: 0.52, gasGiantRinged: 0.50, ice: 0.32, ocean: 0.44, desert: 0.30, volcanic: 0.38 };
    const cloudTex = makeCloudTexture(spec.kind, 512);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: cloudOpacity[spec.kind] ?? 0.4,
      roughness: 1.0,
      metalness: 0.0,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const cloudSeg = Math.max(24, Math.floor(seg * 0.75));
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, cloudSeg, cloudSeg), cloudMat);
    // child di 0,0,0 biar gak dobel position (frame cuma rotate, gak copy position)
    mesh.add(cloud);

    // Ring (hanya gas giant ringed)
    let ring: THREE.Mesh | undefined;
    if (spec.hasRing) {
      const ringMat = new THREE.MeshStandardMaterial({
        color: threeColor("#8a7a6a"), emissive: threeColor("#2a1a0a"), emissiveIntensity: 0.35,
        side: THREE.DoubleSide, roughness: 0.9, transparent: true, opacity: 0.85,
      });
      const ringGeom = new THREE.RingGeometry(radius * 1.6, radius * 2.6, 96);
      ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2 + 0.12;
      mesh.add(ring);
    }

    // Moons (§2.3) — mengorbit planet, fase lunar dari geometri
    const moons: Planet3D["moons"] = [];
    for (let m = 0; m < spec.moons; m++) {
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.18, 16, 16),
        new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), roughness: 1, metalness: 0.1 })
      );
      scene.add(moonMesh);
      moons.push({
        mesh: moonMesh,
        orbit: { semimajor: radius * (2.4 + m * 0.9), eccentricity: 0.03, omega: 0.09 + m * 0.04, phase: m * 1.7, inclination: 0.4 },
      });
    }

    planets.push({
      mesh,
      atmo,
      atmoMat,
      emissiveBase: mat.emissiveIntensity,
      orbit: {
        semimajor: 9000 + i * 5200,
        eccentricity: [0.08, 0.16, 0.05, 0.2, 0.1, 0.06, 0.12, 0.09, 0.04][i % 9],
        omega: [0.12, 0.08, 0.06, 0.045, 0.035, 0.026, 0.02, 0.014, 0.011][i % 9],
        phase: i * 0.9,
        inclination: (i % 3) * 0.06 - 0.06,
      },
      radius,
      spec,
      ring,
      cloud,
      cloudMat,
      moons,
      baseColor: new THREE.Color(threeColor(spec.baseColor)),
    });
  }
}

/** Backdrop planets jauh (§2.2) — sense of scale, bukan COLLIDABLE. */
export function buildBackdrops(ctx: SceneContext): void {
  const { scene, rand, backdrops } = ctx;
  for (const b of backdrops) { scene.remove(b.mesh); (b.mesh.material as THREE.Material).dispose(); }
  backdrops.length = 0;
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: threeColor(colors.backdropPlanet), transparent: true, opacity: 0.35,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(18000 + rand() * 22000, 24, 24), mat);
    mesh.position.set(
      (rand() - 0.5) * 400000,
      (rand() - 0.5) * 120000,
      -180000 - rand() * 300000
    );
    scene.add(mesh);
    backdrops.push({ mesh, orbit: { semimajor: 380000 * (1 + i * 0.15), eccentricity: 0.02, omega: 0.0018 + i * 0.0003, phase: i * 1.3, inclination: 0.05 }, drift: 0 });
  }
}

/** Orbit planet+moon, fase lunar dari geometri, cloud drift, termal 1/r². */
export function updatePlanets(ctx: SceneContext, tick: number): void {
  const { planets, suns } = ctx;
  for (const pl of planets) {
    const p = keplerPosition(pl.orbit, tick);
    pl.mesh.position.copy(p);
    pl.atmo.position.copy(p);
    if (pl.ring) pl.ring.position.copy(p);
    // AAA+ cloud — visual-only, drift beda dari planet (faster)
    if (pl.cloud) {
      const speedMap: Record<string, number> = { gasGiant: 0.00042, gasGiantRinged: 0.00045, ice: 0.00032, ocean: 0.00072, desert: 0.00028, volcanic: 0.00035 };
      pl.cloud.rotation.y += speedMap[pl.spec.kind] ?? 0.0005;
    }
    for (const mo of pl.moons) {
      const mp = keplerPosition(mo.orbit, tick);
      mo.mesh.position.set(p.x + mp.x, p.y + mp.y, p.z + mp.z);
      // §2.3 fase lunar dari geometri (arah relatif ke matahari)
      const mdir = mo.mesh.position.clone().sub(p).normalize();
      const sdir = suns[0].sun.position.clone().sub(p).normalize();
      (mo.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + 0.6 * Math.max(0, mdir.dot(sdir));
    }
  }

  // §2.6 Termal: emissive planet ∝ 1/(1+r²) relatif matahari.
  for (const pl of planets) {
    const d = pl.mesh.position.distanceTo(suns[0].sun.position);
    const r = Math.max(1, d / 5000);
    const thermal = Math.min(1.5, pl.emissiveBase + 1.2 / (r * r));
    (pl.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = thermal;
  }
}
