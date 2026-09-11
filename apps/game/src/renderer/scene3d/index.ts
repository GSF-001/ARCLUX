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
// Iris 1: interior geometry (corridor+promenade) ready — lazy-load DockingState wired in iris 2
import { buildArkInterior as _buildArkInterior } from "../interior";
void _buildArkInterior;
// 10.x planetary — wired ke render loop (10.2-10.6)
import * as _planetary from "./planetary";
import {
  createTerrainMesh,
  getSlopeAt,
  type TerrainOpts,
} from "./planetary/terrain";
import { createOceanMesh, oceanDepthForHeightmap, stormAmpScale } from "./planetary/ocean";
import { createAtmosphere, lerpAtmosphereForAltitude } from "./planetary/atmosphere";
import { ChunkManager, updateChunks } from "./planetary/chunks";
import { lerpSpaceToSurface, canAutoLand, raycastCrash } from "./planetary/surface";
import { createFacilityMesh, updateFacilityHealth, canBuildOnEmptyLand, clampCharacterSpeed } from "./planetary/facilities";
import { attachNightLights, updateNightVisibility } from "./planetary/night";
import { createGeographyMarker, NICHE_COLOR } from "./planetary/geography";
import { createEnvironmentalContext } from "../../../../../packages/gameserver/planetary/environment";
import type { EnvironmentalContext } from "../../../../../packages/gameserver/planetary/environment";
import { generateCosmicEventsForTick } from "../../../../../packages/gameserver/cosmicEvent";
import { createPlanetary10X, tickPlanetary10X, disposePlanetary10X } from "./planetary/wireX";
import { strikeDistanceTo } from "./planetary/lightning";
import { createPlanetary10G, tickPlanetary10G, disposePlanetary10G } from "./planetary/wireG";
import { createEmergency10X, tickEmergency10X, disposeEmergency10X } from "./planetary/wireE";
import { createCinematicC, tickCinematicC, disposeCinematicC } from "./cinematic/wireC";
void _planetary;
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
import type { CockpitOverlay } from "../cockpitOverlay";

export type { CameraMode };

export interface Scene3D {
  renderRegion(region: RegionState): void;
  updateVessel(v: VesselEntity): void;
  setCameraMode(mode: CameraMode): void;
  applyQuality(settings: GameSettings): void;
  setLookYawPitch(yaw: number, pitch: number): void;
  setSfxHandler(cb: (kind: "explosion" | "shield" | "debris") => void): void;
  addGroup(g: THREE.Group): void;
  removeGroup(g: THREE.Group): void;
  /** Iris 6: FPS interior camera follow local pos */
  setInteriorCamera(pos: { x: number; y: number; z: number }, yaw: number, pitch: number): void;
  /** 10.V U4: daftarkan overlay droplet + HUD root (sekali saat boot). */
  setCockpitPresentation(overlay: CockpitOverlay | null, hudRoot: HTMLElement | null): void;
  dispose(): void;
}

export function initScene3D(container?: HTMLElement, settings?: GameSettings): Scene3D {
  const target = container ?? (typeof document !== "undefined" ? document.getElementById("app") : null);
  const width = target?.clientWidth ?? 800;
  const height = target?.clientHeight ?? 600;
  const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const bootSettings: GameSettings = settings ?? { preset: "ULTRA", fpsCap: 0, resolutionScale: 1, pixelRatio: 2, antialias: true, bloom: "high", shadowQuality: "high", nebulaDensity: 12, starBodies: 3, planetCount: 9, planetDetail: 48, beltDensity: 8000, vesselDetail: 3, toneMapping: "ACES", textureSize: 512 } as GameSettings;
  const ctx: SceneContext = createBase(target, width, height, DPR, bootSettings);

  // ── PLANETARY SURFACE (10.1-10.6) ──
  const planetSeed = 0x07a1b2c3;
  const planetRadius = 6371000;
  const terrainLod = 48;
  const terrainSize = 4000;
  const chunkSize = 2000;

  // Terrain
  const terrainMesh = createTerrainMesh(planetSeed, terrainLod, terrainSize, 0, 0);
  terrainMesh.position.set(0, -10, 0);
  ctx.scene.add(terrainMesh);

  // Ocean
  const oceanMesh = createOceanMesh({ size: 6000, seg: 64, windSpeed: 6, depthMap: oceanDepthForHeightmap((terrainMesh as any)._heightmap) });
  oceanMesh.position.set(0, -10, 0);
  ctx.scene.add(oceanMesh);

  // Atmosphere
  const atmoGroup = createAtmosphere(planetRadius / 1e6, "ocean");
  atmoGroup.position.set(0, 0, 0);
  ctx.scene.add(atmoGroup);

  // Cloud group (for surface lerp)
  const cloudGroup = atmoGroup.getObjectByName("clouds") as THREE.Group ?? new THREE.Group();
  const terrainGroup = new THREE.Group();
  terrainGroup.add(terrainMesh);
  const atmosphereGroup = new THREE.Group();
  atmosphereGroup.add(atmoGroup);

  // Chunk manager (client-side streaming)
  const chunkManager = new ChunkManager(chunkSize, 2);
  updateChunks(chunkManager, { x: 0, z: 0 }, ctx.scene, (dist) => dist < 8000 ? 32 : 16);

  // Facilities group
  const facilitiesGroup = new THREE.Group();
  ctx.scene.add(facilitiesGroup);

  // Night lights group
  const nightGroup = new THREE.Group();
  ctx.scene.add(nightGroup);

  // Geography markers group
  const geographyGroup = new THREE.Group();
  ctx.scene.add(geographyGroup);

  // Cinematic atmosphere layer (10.X.1-X.4) — owns sun/shadow/rain/etc systems
  const planetary10X = createPlanetary10X(ctx.scene, planetSeed);
  const planetary10G = createPlanetary10G(ctx.scene);

  // Emergency landing visuals (10.E) — renders the authoritative flag
  const emergency10X = createEmergency10X(ctx.scene);

  // Cinematic presentation layer (10.C full) — core + response, one wire
  const cinematicC = createCinematicC();

  // 10.V U4: handle presentasi kokpit (diregistrasi renderer.ts saat boot).
  let cockpitOverlay: CockpitOverlay | null = null;
  let cockpitHudRoot: HTMLElement | null = null;
  const setCockpitPresentation = (overlay: CockpitOverlay | null, hudRoot: HTMLElement | null): void => {
    cockpitOverlay = overlay;
    cockpitHudRoot = hudRoot;
  };

  // Environmental context (derived from server contract)
  let envContext: EnvironmentalContext | null = null;
  let planetTick = 0;
  const worldTime = Date.now();

  function updateEnvironmentalContext(): void {
    planetTick++;
    // F7: anomaly overlay regenerated deterministically (same function +
    // same inputs as the server — zero bandwidth). Demo mapping:
    // regionId = planetId until snapshot sync carries the authoritative id.
    const anomalyChunks = generateCosmicEventsForTick("planet-07", planetTick, "planet-07")
      .filter((e) => e.kind === "anomaly_gravity")
      .map((e) => (e.payload["chunkKey"] as string | undefined) ?? "")
      .filter((k) => k.length > 0);
    envContext = createEnvironmentalContext({
      planetId: "planet-07",
      planetSeed,
      chunkKey: `planet-07:0:0`,
      simulationTick: planetTick,
      worldTime,
      terrainHeight: 0,
      oceanDepth: -10,
      anomalyChunks,
    });
  }
  updateEnvironmentalContext();

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

    // ── PLANETARY UPDATE (10.2-10.6) ──
    if (ctx.firstVesselRef) {
      const anchor = ctx.anchor;
      const chunkCenter = { x: anchor.x, z: anchor.z };

      // Position planet at anchor (follow player)
      terrainMesh.position.set(anchor.x, -10, anchor.z);
      oceanMesh.position.set(anchor.x, -10, anchor.z);
      atmoGroup.position.set(anchor.x, 0, anchor.z);

      // Update chunks around player
      updateChunks(chunkManager, chunkCenter, ctx.scene, (dist) => dist < 8000 ? 32 : 16);

      // Lerp atmosphere for altitude (surface approach)
      const altitude = Math.max(0, Math.min(1, (anchor.y + 10) / 100));
      lerpAtmosphereForAltitude(atmoGroup, altitude);
      lerpSpaceToSurface(altitude, cloudGroup as any, terrainGroup, atmosphereGroup as any);

      // Update environmental context per tick
      if (planetTick % 60 === 0) updateEnvironmentalContext();
      if (envContext) {
        // Update ocean wind from EnvironmentalContext
        const windDir = envContext.wind.direction;
        // F8: mesh amplitude follows live storm state (calm shrinks, storm grows).
        (oceanMesh as any)._tick?.(1 / 60, windDir, stormAmpScale(envContext.ocean.waveAmplitude));
        // Update atmosphere cloud drift
        (atmoGroup as any)._tick?.(1 / 60, envContext.wind.speed);
        // Night visibility
        const isNight = envContext.timeOfDay === "night";
        updateNightVisibility(nightGroup, isNight, envContext.sun.intensity);
      }

      // Spawn facilities on empty land if none exist
      if (facilitiesGroup.children.length === 0) {
        const facilityPositions = [
          { kind: "Spaceport" as const, x: 2000, z: 2000 },
          { kind: "Hangar" as const, x: -1500, z: 1000 },
          { kind: "Radar" as const, x: 3000, z: -500 },
          { kind: "Military" as const, x: -2000, z: -2000 },
          { kind: "Landing Pad" as const, x: 1000, z: -1500 },
          { kind: "Storage" as const, x: -800, z: 2500 },
          { kind: "Repair" as const, x: 2500, z: -2000 },
          { kind: "Manufacturing" as const, x: -1000, z: -3000 },
          { kind: "Comms" as const, x: 500, z: 3000 },
          { kind: "Refit" as const, x: -3000, z: 500 },
        ];
        for (const f of facilityPositions) {
          const h = (terrainMesh as any)._heightmap
            ? 0 // simplified — terrain.ts getSlopeAt would need chunk coords
            : 0;
          const canBuild = canBuildOnEmptyLand(h, 0.1, h < -2);
          if (canBuild) {
            const mesh = createFacilityMesh(f.kind, { kind: f.kind, position: { x: f.x, y: 0, z: f.z } });
            facilitiesGroup.add(mesh);
            // Attach night lights
            attachNightLights(mesh, { kind: f.kind, position: { x: f.x, y: 0, z: f.z }, health: 100 });
            nightGroup.add(mesh);
            // Geography marker
            const marker = createGeographyMarker({
              height: h, slope: 0.1, biome: "plains", latitude: 0,
              distToCoast: 5000, forestDensity: 0, wetness: 0,
              position: { x: f.x, y: 0, z: f.z },
            }, [h]);
            marker.position.set(f.x, h + 6, f.z);
            geographyGroup.add(marker);
          }
        }
      }

      // Directional light follows sun
      const sunDir = envContext ? new THREE.Vector3(
        Math.cos((worldTime % 86400000) / 86400000 * Math.PI * 2),
        Math.sin((worldTime % 86400000) / 86400000 * Math.PI * 2) * 0.6,
        0.2
      ).normalize() : new THREE.Vector3(0, 1, 0);
      // Update scene ambient light intensity based on time of day
      const sunIntensity = envContext ? envContext.sun.intensity : 0.5;
      if (ctx.ambient) ctx.ambient.intensity = 0.3 + sunIntensity * 0.7;
    }
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

    // ── PLANETARY TICK (10.2-10.6) ──
    // Ocean wave animation (F8: amplitude follows live storm state)
    (oceanMesh as any)._tick?.(1 / 60, envContext?.wind.direction ?? 0, envContext ? stormAmpScale(envContext.ocean.waveAmplitude) : 1);
    // Atmosphere cloud drift
    (atmoGroup as any)._tick?.(1 / 60, envContext?.wind.speed ?? 2);
    // Cloud group opacity based on altitude
    const alt = ctx.firstVesselRef ? Math.max(0, Math.min(1, (ctx.anchor.y + 10) / 100)) : 0;
    lerpAtmosphereForAltitude(atmoGroup, alt);
    // Night update every 2s
    if (envContext && Math.floor(t / 2000) !== Math.floor((t - 1 / 60 * 1000) / 2000)) {
      updateNightVisibility(nightGroup, envContext.timeOfDay === "night", envContext.sun.intensity);
    }

    // ── CINEMATIC ATMOSPHERE TICK (10.X.1-X.4) ──
    if (envContext) {
      const dtX = 1 / 60;
      tickPlanetary10X(planetary10X, ctx.scene, envContext, dtX, {
        timeSec: envContext.worldTime / 1000 + envContext.simulationTick * 0.1,
        anchor: { x: ctx.anchor.x, z: ctx.anchor.z },
        cameraPos: ctx.camera
          ? { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z }
          : { x: 0, y: 0, z: 0 },
        altitude: ctx.firstVesselRef ? Math.max(0, ctx.anchor.y + 10) : 0,
        vessel: ctx.firstVesselRef,
        ambient: ctx.ambient,
        renderer: ctx.renderer,
      });
      tickPlanetary10G(planetary10G, ctx.scene, envContext, dtX, {
        timeSec: envContext.worldTime / 1000 + envContext.simulationTick * 0.1,
        anchor: { x: ctx.anchor.x, z: ctx.anchor.z },
        cameraPos: ctx.camera ? { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z } : { x: 0, y: 0, z: 0 },
        altitude: ctx.firstVesselRef ? Math.max(0, ctx.anchor.y + 10) : 0,
      });
      // ── CINEMATIC LAYER TICK (10.C full: core feeds response) ──
      const vessel = ctx.firstVesselRef;
      const vv = vessel?.velocity;
      const camX = ctx.camera ? ctx.camera.position.x : 0;
      const camZ = ctx.camera ? ctx.camera.position.z : 0;
      tickCinematicC(cinematicC, ctx.scene, envContext, dtX, {
        timeSec: envContext.worldTime / 1000 + envContext.simulationTick * 0.1,
        altitude: vessel ? Math.max(0, ctx.anchor.y + 10) : 0,
        vesselSpeed: vv ? Math.hypot(vv.x, vv.y, vv.z) : 0,
        vesselState: vessel?.emergency?.state,
        camera: ctx.camera ?? undefined,
        cameraPosXZ: { x: camX, z: camZ },
        anchor: { x: ctx.anchor.x, z: ctx.anchor.z },
        // F2: real camera-to-strike distance (fresh <8s) — stale/missing
        // falls back to STALE_STRIKE_DISTANCE inside strikeDistanceTo.
        distanceToLightning: strikeDistanceTo(
          { x: camX, y: ctx.camera ? ctx.camera.position.y : 0, z: camZ },
          planetary10X.lightning.lastEvent,
          envContext.worldTime / 1000 + envContext.simulationTick * 0.1,
        ),
        renderer: ctx.renderer,
        // 10.V U4: presentasi kokpit hidup dari state yang sama.
        cockpitPass: ctx.cockpitPass ?? undefined,
        cockpitOverlay,
        hudRoot: cockpitHudRoot ?? undefined,
        cockpitDroplets: (ctx.settings.preset ?? "HIGH") !== "LOW",
        // 10.V P1: grade + touch.
        gradePass: ctx.gradePass ?? undefined,
        touchPass: ctx.touchPass ?? undefined,
        touchAspect: ctx.width / Math.max(1, ctx.height),
      });
    }

    // ── EMERGENCY LANDING TICK (10.E) ──
    {
      const vessel = ctx.firstVesselRef;
      const local = vessel ? ctx.vessels.get(vessel.id)?.position : undefined;
      tickEmergency10X(
        emergency10X,
        vessel,
        local ? { x: local.x, y: local.y, z: local.z } : { x: 0, y: 0, z: 0 },
        1 / 60,
        envContext ? envContext.worldTime / 1000 + envContext.simulationTick * 0.1 : performance.now() / 1000,
        envContext
          ? { direction: envContext.wind.direction, speed: envContext.wind.speed }
          : { direction: 0, speed: 0 },
      );
    }

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
    // Dispose planetary
    ctx.scene.remove(terrainMesh); ctx.scene.remove(oceanMesh); ctx.scene.remove(atmoGroup);
    disposeGroup(terrainMesh as any); disposeGroup(oceanMesh as any); disposeGroup(atmoGroup);
    disposeGroup(facilitiesGroup); disposeGroup(nightGroup); disposeGroup(geographyGroup);
    disposePlanetary10X(ctx.scene, planetary10X);
    disposePlanetary10G(ctx.scene, planetary10G);
    disposeEmergency10X(ctx.scene, emergency10X);
    disposeCinematicC(ctx.scene, cinematicC);
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

  const setInteriorCamera = (pos: { x: number; y: number; z: number }, yaw: number, pitch: number): void => {
    const cam = ctx.camera;
    if (!cam) return;
    const eye = 1.7;
    cam.position.set(pos.x, pos.y + eye, pos.z);
    const d = 10;
    const lx = pos.x + Math.sin(yaw) * Math.cos(pitch) * d;
    const ly = pos.y + eye + Math.sin(pitch) * d;
    const lz = pos.z + Math.cos(yaw) * Math.cos(pitch) * d;
    cam.lookAt(lx, ly, lz);
  };

  return {
    renderRegion,
    updateVessel: (v: VesselEntity) => updateVessel(ctx, v),
    setCameraMode: (mode: CameraMode) => setCameraMode(ctx, mode),
    applyQuality: (s: GameSettings) => applyQuality(ctx, s),
    setLookYawPitch: (yaw: number, pitch: number) => setLookYawPitch(ctx, yaw, pitch),
    setSfxHandler: (cb: (kind: "explosion" | "shield" | "debris") => void) => { ctx.sfxHandler = cb; },
    addGroup: (g: THREE.Group) => ctx.scene.add(g),
    removeGroup: (g: THREE.Group) => ctx.scene.remove(g),
    setInteriorCamera,
    setCockpitPresentation,
    dispose,
  };
}
