// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/index.ts — LIVING COSMIC SYSTEM, orchestration layer (blueprint 01
// §2, D-008: visual ≠ otoritas posisi). Render cinematic, orbit deterministik.
//
// Hasil split scene3d.ts (1577 baris → 14 modul domain, zero behavior change):
// index ini HANYA orkestrasi — rakit runtime (bootstrap), panggil builder tiap
// domain sesuai urutan lama, jalanin render loop, expose facade Scene3D.
// §2.1 sistem bintang · §2.2 COLLIDABLE/ATMOSPHERIC/BACKDROP · §2.3 orbit
// Kepler + fase lunar · §2.4 cosmic events · §2.5 dua skala · §2.6 termal
// 1/r² · §21 camera modes · §22 LOD. Post: EffectComposer + UnrealBloomPass
// + OutputPass (core THREE, no CDN — CSP default-src 'self').

import * as THREE from "three";
import type { RegionState, StationEntity, VesselEntity } from "../../../../../packages/gameserver/types";
import type { GameSettings } from "../settings";
import { createBase, disposeGroup, type SceneContext } from "./bootstrap";
import { createCamera, setCameraMode, setLookYawPitch, updateCamera, type CameraMode } from "./camera";
import { createPost } from "./post";
import { buildStars } from "./stars";
import { buildNebula } from "./nebula";
import { buildSuns, updateSuns } from "./suns";
import { buildBackdrops, buildPlanetSystem, updatePlanets } from "./planets";
import { buildBelt } from "./belt";
import { buildCosmic, disposeCosmic, updateCosmic } from "./cosmic";
import { buildArk, updateArk } from "./ark";
import { clampLocal, ensureEntry, updateVessel, updateVesselInterp } from "./vessels";
import { buildStation } from "./stations";
import { disposeExplosions, spawnExplosion, updateExplosions } from "./explosions";
import { applyQuality } from "./quality";

export type { CameraMode };

export interface Scene3D {
  renderRegion(region: RegionState): void;
  updateVessel(v: VesselEntity): void;
  setCameraMode(mode: CameraMode): void;
  applyQuality(settings: GameSettings): void;
  setLookYawPitch(yaw: number, pitch: number): void;
  setSfxHandler(cb: (kind: "explosion" | "shield" | "debris") => void): void;
  dispose(): void;
}

export function initScene3D(container?: HTMLElement, settings?: GameSettings): Scene3D {
  const target = container ?? (typeof document !== "undefined" ? document.getElementById("app") : null);
  const width = target?.clientWidth ?? 800;
  const height = target?.clientHeight ?? 600;
  const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const bootSettings: GameSettings = settings ?? { preset: "ULTRA", fpsCap: 0, resolutionScale: 1, pixelRatio: 2, antialias: true, bloom: "high", shadowQuality: "high", nebulaDensity: 12, starBodies: 3, planetCount: 9, planetDetail: 48, beltDensity: 8000, vesselDetail: 3, toneMapping: "ACES" } as GameSettings;
  const ctx: SceneContext = createBase(target, width, height, DPR, bootSettings);

  // Rakit sesuai urutan file lama (konsumsi rand deterministik dipertahankan).
  ctx.camera = createCamera(width, height);
  createPost(ctx);
  buildStars(ctx);
  buildNebula(ctx, 9);
  buildSuns(ctx, 1);
  buildPlanetSystem(ctx, ctx.planetCount, 48);
  buildBelt(ctx, ctx.beltCount);
  buildBackdrops(ctx);
  buildCosmic(ctx);
  buildArk(ctx);

  // §2.3 Orbit deterministik per tick — smooth di sub-tick via TIME_BASE.
  const simTick = (): number => ctx.lastTick + (performance.now() - ctx.lastSnapshotAt) / 100;

  const renderRegion = (region: RegionState): void => {
    ctx.lastTick = region.tick;
    ctx.lastSnapshotAt = performance.now();
    // Rotasi prev←cur: nilai lama jadi starting point interpolasi.
    ctx.prev.clear();
    for (const [id, p] of ctx.cur) ctx.prev.set(id, p.clone());
    ctx.cur.clear();

    ctx.firstVesselRef = undefined;
    for (const e of region.entities.values()) {
      if (e.kind === "vessel") {
        const ve = e as VesselEntity;
        if (!ctx.firstVesselRef) { ctx.firstVesselRef = ve; ctx.anchor.set(ve.position.x, ve.position.y, ve.position.z); }
      }
    }
    // Pass kedua — anchor final.
    for (const e of region.entities.values()) {
      if (e.kind === "vessel") updateVessel(ctx, e as VesselEntity);
      else {
        const se = e as StationEntity;
        const grp = ensureEntry(ctx, se.id, () => buildStation(), ctx.stations);
        const p = clampLocal(new THREE.Vector3(se.position.x, se.position.y, se.position.z), ctx.anchor);
        grp.position.copy(p);
      }
    }
    // Bersihkan entity yang mati — Fase 4 trigger ledakan di posisi terakhir.
    const live = new Set<string>();
    for (const e of region.entities.values()) live.add(e.id);
    for (const [id, grp] of ctx.vessels) if (!live.has(id)) {
      const p = ctx.cur.get(id)?.clone() ?? grp.position.clone();
      spawnExplosion(ctx, p);
      ctx.scene.remove(grp); disposeGroup(grp); ctx.vessels.delete(id); ctx.prev.delete(id); ctx.cur.delete(id);
    }
    for (const [id, grp] of ctx.stations) if (!live.has(id)) { ctx.scene.remove(grp); disposeGroup(grp); ctx.stations.delete(id); }
  };

  const frame = (now: number): void => {
    ctx.rafId = requestAnimationFrame(frame);
    const t = now; // ms — dipakai kamera cinematic
    const cap = ctx.settings.fpsCap;
    if (cap) {
      const elapsed = now - ctx.lastFrame;
      if (elapsed < 1000 / cap) { updateCamera(ctx, t); return; } // throttle ke cap (camera tetap hidup)
    }
    ctx.lastFrame = now;

    // Fase 1 — env map regen tiap 10 frame (presentasi, bukan otoritas).
    if (++ctx.envFrame % 10 === 0) {
      if (ctx.pmremTarget) ctx.pmremTarget.dispose();
      if (ctx.pmrem) {
        ctx.pmremTarget = ctx.pmrem.fromScene(ctx.scene, 0.04);
        ctx.scene.environment = ctx.pmremTarget.texture;
      }
    }

    // §2.3/§2.5: sistem bintang & planet—deterministik, mengorbit barycenter.
    const tick = simTick();
    updateSuns(ctx, tick);
    updatePlanets(ctx, tick);
    updateCosmic(ctx, t);
    updateArk(ctx, t);
    updateExplosions(ctx);

    // Interpolasi vessel (presentation ✓, autoritas server tetap D-008).
    updateVesselInterp(ctx, now);

    updateCamera(ctx, t);
    ctx.composer?.render();
  };

  // Snapshot timing (biar interp akurat)
  ctx.renderer.setPixelRatio(Math.min(DPR, 2));
  const stopLoop = (): void => cancelAnimationFrame(ctx.rafId);

  const onResize = (): void => {
    const w = target?.clientWidth ?? width;
    const h = target?.clientHeight ?? height;
    if (!ctx.camera) return;
    ctx.camera.aspect = w / h;
    ctx.camera.updateProjectionMatrix();
    ctx.renderer.setSize(w, h);
    ctx.composer?.setSize(w, h);
  };
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);

  const dispose = (): void => {
    if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
    stopLoop();
    ctx.running = false;
    if (ctx.pmremTarget) { ctx.pmremTarget.dispose(); ctx.pmremTarget = null; }
    ctx.pmrem?.dispose();
    ctx.scene.environment = null;
    ctx.renderer.dispose();
    ctx.composer?.dispose();
    for (const m of ctx.vessels.values()) disposeGroup(m);
    for (const m of ctx.stations.values()) disposeGroup(m);
    ctx.vessels.clear(); ctx.stations.clear();
    disposeExplosions(ctx);
    for (const pl of ctx.planets) {
      ctx.scene.remove(pl.mesh); ctx.scene.remove(pl.atmo); if (pl.ring) ctx.scene.remove(pl.ring);
      for (const mo of pl.moons) ctx.scene.remove(mo.mesh);
    }
    for (const b of ctx.backdrops) ctx.scene.remove(b.mesh);
    disposeCosmic(ctx);
    if (target && ctx.renderer.domElement.parentElement === target) target.removeChild(ctx.renderer.domElement);
  };

  // Start rAF
  ctx.running = true;
  if (settings) applyQuality(ctx, settings);
  ctx.lastFrame = performance.now();
  ctx.lastSnapshotAt = ctx.lastFrame;
  ctx.rafId = requestAnimationFrame(frame);

  return {
    renderRegion,
    updateVessel: (v: VesselEntity) => updateVessel(ctx, v),
    setCameraMode: (mode: CameraMode) => setCameraMode(ctx, mode),
    applyQuality: (s: GameSettings) => applyQuality(ctx, s),
    setLookYawPitch: (yaw: number, pitch: number) => setLookYawPitch(ctx, yaw, pitch),
    setSfxHandler: (cb: (kind: "explosion" | "shield" | "debris") => void) => { ctx.sfxHandler = cb; },
    dispose,
  };
}
