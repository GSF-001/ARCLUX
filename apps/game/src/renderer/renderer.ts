// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/renderer.ts — bootstrap renderer (three scene) + input + network
// di browser context. Server-authoritative: client render snapshot + kirim intent.
//
// Layering (D-008):
//   input (WASD/QE + look) → intent `move` → server /intent
//   server tick → /snapshot → scene + HUD render (+ rAF smooth interpolation)

import { initScene3D, type Scene3D } from "./scene3d/index";
import { initHud, type Hud } from "./hud";
import { connectNet, type NetHandle } from "./net";
import { initInput, type InputHandle } from "./input";
import { initAudio, type AudioHandle } from "./audio";
import { initMenu, type MenuHandle, type MenuCameraMode, createCharacterOverlay } from "./menu";
import { initLanding } from "./landing";
import { loadSettings } from "./settings";
import { buildArkInterior } from "./interior";
import type { RegionSnapshot, VesselEntity, WorldEntity } from "../../../../packages/gameserver/types";

export type DockingState = "EXTERIOR" | "ENTERING" | "INTERIOR";

export interface RendererHandle {
  scene: Scene3D;
  hud: Hud;
  net: NetHandle;
  input: InputHandle;
  audio: AudioHandle;
  menu: MenuHandle;
  dockingState: DockingState;
  enterInterior(): void;
  exitInterior(): void;
  dispose(): void;
}

/** Adapt server `RegionSnapshot` (entities: array) → `RegionState` (Map) untuk renderer. */
function toRegionState(snap: RegionSnapshot) {
  return {
    regionId: snap.regionId,
    name: snap.name,
    tick: snap.tick,
    createdAt: snap.createdAt,
    entities: new Map<string, WorldEntity>(snap.entities.map((e: WorldEntity) => [e.id, e])),
  };
}

export function bootstrapRenderer(opts?: { serverUrl?: string }): RendererHandle {
  const settings = loadSettings();
  const scene = initScene3D(undefined, settings);
  const hud = initHud();
  const net = connectNet(opts?.serverUrl);
  const audio = initAudio();
  const input = initInput({
    send: (intent) => { void net.send(intent); },
    onLook: (yaw, pitch) => scene.setLookYawPitch(yaw, pitch),
    onWeapon: () => { try { audio.sfxWeapon(); } catch {} },
  });
  const menu = initMenu({
    onQuality: (s) => scene.applyQuality(s),
    onAudio: (s) => audio.setEnabled(s.muted, s.masterVolume),
    onCameraMode: (mode) => scene.setCameraMode(mode as Parameters<Scene3D["setCameraMode"]>[0]),
    onSfx: (kind) => audio.ui(kind === "click" ? "click" : "hover"),
  }, audio);

  // Fase 9 — CharacterCustom overlay (repo = karakter)
  let lastLocalVessel: VesselEntity | undefined;
  let lastPlayerId = "player-1";
  let hasSpawnedCharacter = false;
  const characterOverlay = createCharacterOverlay((data) => {
    hasSpawnedCharacter = true;
    const vesselId = lastLocalVessel?.id ?? "vessel-1";
    const intent = {
      playerId: lastPlayerId,
      entityId: vesselId,
      type: "spawn_character" as const,
      seq: Date.now() % 100000,
      payload: { ...data, vesselId, deck: "plaza" },
    };
    void net.send(intent as unknown as import("../../../../packages/gameserver/types").PlayerIntent);
  });

  // Iris 5 — DockingState + lazy interior (corridor+promenade+plaza+96 habitat)
  let dockingState: DockingState = "EXTERIOR";
  let interiorGroup: import("three").Group | null = null;
  let interiorBounds: import("three").Box3[] = [];
  const enterInterior = (): void => {
    if (dockingState !== "EXTERIOR") return;
    dockingState = "ENTERING";
    if (!interiorGroup) {
      const built = buildArkInterior();
      interiorGroup = built.group;
      interiorBounds = built.walkBounds;
      scene.addGroup(interiorGroup);
      input.setWalkBounds(interiorBounds);
    } else {
      scene.addGroup(interiorGroup);
    }
    input.setInteriorMode("FPS_INTERIOR");
    input.setInteriorPosition({ x: 0, y: 0, z: 0 });
    dockingState = "INTERIOR";
    if (!interiorPoll) {
      interiorPoll = setInterval(() => {
        if (dockingState !== "INTERIOR") return;
        const pos = input.getInteriorPosition();
        const { yaw, pitch } = input.getLook();
        hud.setInterior(deckForPos(pos), pos);
        scene.setInteriorCamera(pos, yaw, pitch);
      }, 1000 / 30);
    }
    // Fase 9: show CharacterCustom on first interior enter
    if (!hasSpawnedCharacter) {
      setTimeout(() => characterOverlay.show(), 400);
    }
  };
  const exitInterior = (): void => {
    if (dockingState !== "INTERIOR") return;
    dockingState = "EXTERIOR";
    input.setInteriorMode("EXTERIOR");
    if (interiorGroup) scene.removeGroup(interiorGroup);
    hud.clearInterior();
    if (interiorPoll) { clearInterval(interiorPoll); interiorPoll = null; }
  };

  // Iris 6: HUD deck + camera FPS follow interiorPos
  const deckForPos = (p: { x: number; y: number; z: number }): string => {
    if (Math.abs(p.x) < 400 && Math.abs(p.z) < 400) return "plaza";
    if (Math.abs(p.x) < 2100 && Math.abs(p.z) < 40) return "corridor";
    for (let r = 0; r < 4; r++) {
      const radius = 640 + r * 46;
      const cx = -400 + r * 500;
      const d = Math.hypot(p.x - cx, p.z);
      if (Math.abs(d - radius) < 40) return "promenade";
    }
    return "habitat";
  };
  let interiorPoll: ReturnType<typeof setInterval> | null = null;
  // Fase 5 — wire explosion/shield/debris sfx ke scene (server-authoritative, client hanya play)
  scene.setSfxHandler((kind) => {
    try {
      if (kind === "explosion") audio.sfxExplosion();
      else if (kind === "shield") audio.sfxShieldHit();
      else audio.sfxDebris();
    } catch {}
  });

  // LANDING MMO AAA+ — live CCTV background (scene3d) + glass overlay
  let landing: ReturnType<typeof initLanding> | null = null;
  let landingPoll: number | undefined;
  const showLanding = (): void => {
    if (landing) return;
    landing = initLanding({
      onLaunch: () => {
        hideLanding();
        // focus game canvas
        (document.querySelector("#app canvas") as HTMLElement | null)?.focus?.();
      },
      onTrailer: () => window.open("https://github.com/GSF-001/ARCLUX", "_blank"),
    });
    // Live stats — poll snapshot, bukan tempelan
    const tickStats = async (): Promise<void> => {
      try {
        const snap: RegionSnapshot = (await net.fetchSnapshot()) as unknown as RegionSnapshot;
        const players = snap.entities.filter((e) => e.kind === "vessel").length;
        const factions = new Set(snap.entities.map((e) => (e as unknown as { faction?: string }).faction).filter(Boolean)).size;
        const destroyed = 0; // TODO wire GameEvent wreckage count when lineage persisted
        landing?.setStats({ players, regions: 1, factions, destroyed });
      } catch {
        landing?.setStats({ players: 0, regions: 0, factions: 0, destroyed: 0 });
      }
    };
    void tickStats();
    landingPoll = window.setInterval(() => void tickStats(), 4000);
  };
  const hideLanding = (): void => {
    if (landingPoll) window.clearInterval(landingPoll);
    landing?.dispose();
    landing = null;
  };
  // Show landing on boot — MMORPG nuance, bukan langsung game
  showLanding();

  // Skena mulai dari settings tersimpan; audio unlock pertama interaksi.
  scene.applyQuality(settings);

  let lastSpeed = 0;
  let ambientHandle: ReturnType<AudioHandle["sfxAmbientHum"]> | null = null;
  const stop = net.onState((snap) => {
    const state = toRegionState(snap);
    scene.renderRegion(state);
    hud.update(state);
    // Setiap vessel dari server → input mengenali pilot local (entity pertama).
    let localVessel: VesselEntity | undefined;
    for (const e of state.entities.values()) {
      if (e.kind === "vessel") { localVessel = e as VesselEntity; break; }
    }
    input.setLocalVessel(localVessel);
    if (localVessel) { lastLocalVessel = localVessel; lastPlayerId = localVessel.owner ?? lastPlayerId; }
    // Audio: engine hum ∝ kecepatan normalized + ambient hum continuous (Fase 5)
    if (localVessel) {
      const v = localVessel.velocity;
      const sp = Math.min(1, Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) / 250);
      if (Math.abs(sp - lastSpeed) > 0.01) { audio.setSpeed(sp); lastSpeed = sp; }
      if (sp > 0.06 && !ambientHandle) ambientHandle = audio.sfxAmbientHum() ?? null;
      else if (sp <= 0.01 && ambientHandle) { ambientHandle.stop(); ambientHandle = null; }
    } else if (ambientHandle) { ambientHandle.stop(); ambientHandle = null; }
  });

  // Unlock audio + buka menu di ESC (interaction-driven, autoplay policy).
  const onDocClick = (): void => { audio.unlock(); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "KeyF" && dockingState === "EXTERIOR") { e.preventDefault(); enterInterior(); return; }
    if (e.code === "Escape" && dockingState === "INTERIOR") { e.preventDefault(); exitInterior(); return; }
    if (e.code === "Escape" && !menu.isOpen) { e.preventDefault(); menu.open(); audio.ui("click"); }
  };
  document.addEventListener("click", onDocClick, { once: true });
  window.addEventListener("keydown", onKeyDown);

  input.attach();

  const dispose = () => {
    try { ambientHandle?.stop(); } catch {}
    if (interiorPoll) { clearInterval(interiorPoll); interiorPoll = null; }
    hideLanding();
    stop();
    input.detach();
    window.removeEventListener("keydown", onKeyDown);
    scene.dispose();
    hud.dispose();
    menu.dispose();
    audio.dispose();
  };

  // Expose for manual control in devtools
  if (typeof window !== "undefined") (window as any).__arcluxRenderer = { scene, net, hud, input, audio, menu, get dockingState() { return dockingState; }, enterInterior, exitInterior };

  return {
    scene, hud, net, input, audio, menu,
    get dockingState(): DockingState { return dockingState; },
    enterInterior, exitInterior, dispose,
  };
}

if (typeof document !== "undefined") {
  const h = bootstrapRenderer();
  // Live UI hook — expose scene/net for devtools + auto-wire tick
  let lastTick = -1;
  const poll = async () => {
    try {
      const snap: any = await h.net.fetchSnapshot();
      if (snap.tick !== lastTick) { lastTick = snap.tick; h.hud.setTick(snap.tick); }
    } catch {}
    setTimeout(poll, 100);
  };
  poll();
}