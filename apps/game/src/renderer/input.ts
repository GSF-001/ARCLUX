// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/input.ts — FREE-FLIGHT control binding (01 §4/§6).
// W maju · S mundur · A/D strafe · Q/E vertikal · Shift boost · Space brake ·
// pointer-look (mouse). Configurable via settings (rebind dari controls panel).
// Server-authoritative (D-008): client ngirim intent `move`, server yang integrasi.

import type { PlayerIntent, Vec3, VesselEntity } from "../../../../packages/gameserver/types";
import { loadSettings } from "./settings";

export type InteriorMode = "EXTERIOR" | "FPS_INTERIOR";

export interface InputHandle {
  /** Bind DOM listeners ke window. panggil sekali saat game jalan. */
  attach(): void;
  /** Lepas listener. */
  detach(): void;
  /** Handle pemilik vessel (via snapshot). */
  setLocalVessel(v: VesselEntity | undefined): void;
  /** Intent terakhir yang dikirim (untuk debug/otomatis poll). */
  currentIntent(): PlayerIntent | undefined;
  /** Kunci arah yang sedang ditekan (debug). */
  state(): { up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean; brake: boolean };
  /** Iris 4: switch exterior ↔ interior FPS */
  setInteriorMode(mode: InteriorMode): void;
  getInteriorMode(): InteriorMode;
  setWalkBounds(bounds: import("three").Box3[]): void;
  getInteriorPosition(): { x: number; y: number; z: number };
  setInteriorPosition(p: { x: number; y: number; z: number }): void;
  getLook(): { yaw: number; pitch: number };
}

export function initInput(opts: {
  send: (intent: PlayerIntent) => void;
  /** Yaw/pitch deltas dari mouse-look → scene.setLookYawPitch. */
  onLook?: (yaw: number, pitch: number) => void;
  onWeapon?: () => void;
  /** Iris 4: walk bounds dari interior (Box3). */
  walkBounds?: import("three").Box3[];
}): InputHandle {
  const keys = new Set<string>();
  let playerId = "player-1";
  let entityId = "vessel-1";
  let hasLocal = false;
  let lastSeq = 0;
  let lastSentAt = 0;
  let localVessel: VesselEntity | undefined;
  let lookYaw = 0, lookPitch = 0;
  let pointerLocked = false;

  // Iris 4 — FPS interior state
  let interiorMode: InteriorMode = "EXTERIOR";
  let interiorPos = { x: 0, y: 0, z: 0 };
  let interiorVel = { x: 0, y: 0, z: 0 };
  let onGround = true;
  let walkBounds: import("three").Box3[] = opts.walkBounds ?? [];
  let fpsTimer: ReturnType<typeof setInterval> | null = null;

  const bindings = (): ReturnType<typeof loadSettings> => loadSettings();
  const k = (): ReturnType<typeof loadSettings> => bindings();

  const isBound = (code: string): boolean => {
    const s = k();
    return code === s.keyForward || code === s.keyReverse || code === s.keyStrafeLeft ||
      code === s.keyStrafeRight || code === s.keyUp || code === s.keyDown ||
      code === s.keyBoost || code === s.keyBrake;
  };

  /** Terjemahkan key → offset thrust (best-effort; server clamp & normalisasi). */
  const offsets = (): { tx: number; ty: number; tz: number; boost: boolean; brake: boolean } => {
    const s = k();
    const STEP = 2600;
    let tx = 0, ty = 0, tz = 0;
    if (keys.has(s.keyForward)) tz -= STEP * (KeyStep[s.keyForward] ?? 1.5);
    if (keys.has(s.keyReverse)) tz += STEP * (KeyStep[s.keyReverse] ?? 1.0);
    if (keys.has(s.keyStrafeLeft)) tx -= STEP * (KeyStep[s.keyStrafeLeft] ?? 1.0);
    if (keys.has(s.keyStrafeRight)) tx += STEP * (KeyStep[s.keyStrafeRight] ?? 1.0);
    if (keys.has(s.keyUp)) ty += STEP * (KeyStep[s.keyUp] ?? 0.8);
    if (keys.has(s.keyDown)) ty -= STEP * (KeyStep[s.keyDown] ?? 0.8);
    const boost = keys.has(s.keyBoost);
    const brake = keys.has(s.keyBrake) && !boost;
    return { tx, ty, tz, boost, brake };
  };

  const sendMove = (now: number): void => {
    if (!hasLocal || !localVessel) return;
    const { tx, ty, tz, boost, brake } = offsets();
    const base = localVessel.position;
    // Speed per §6: maju kuat, boost klaim 2.2× (~550 m/s).
    const boostFactor = boost ? 2.2 : 1;
    const target: Vec3 = brake
      ? { ...base } // brake → server lihat jarak<1 → reverse thrust (cap mati)
      : {
          x: base.x + tx * boostFactor,
          y: base.y + ty * boostFactor,
          z: base.z + tz * boostFactor,
        };
    // Brake selalu dikirim (diperlukan biar vessel berhenti); gerak cuma saat ada input.
    if (!brake && tx === 0 && ty === 0 && tz === 0) return;
    const intent: PlayerIntent = {
      playerId, entityId, type: "move", seq: ++lastSeq,
      payload: { ...target },
    };
    opts.send(intent);
    lastSentAt = now;
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Escape") { if (pointerLocked) return; }
    // Fase 5 — sfxWeapon trigger (attack) — KeyF / KeyJ / Space+Ctrl
    if (e.code === "KeyF" || e.code === "KeyJ" || (e.code === "Space" && e.ctrlKey)) {
      e.preventDefault();
      if (hasLocal) {
        const intent: PlayerIntent = { playerId, entityId, type: "attack", seq: ++lastSeq, payload: { weapon: "plasma", targetId: entityId } };
        opts.send(intent);
      }
      opts.onWeapon?.();
      return;
    }
    if (isBound(e.code)) {
      e.preventDefault();
      keys.add(e.code);
      sendMove(Date.now());
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    if (keys.delete(e.code)) sendMove(Date.now());
  };

  const onBlur = (): void => { keys.clear(); };

  // Iris 4 — FPS tick 60Hz: WASD+Shift+sprint, Space jump, gravity, Box3
  const fpsTick = (): void => {
    if (interiorMode !== "FPS_INTERIOR") return;
    const dt = 1 / 60;
    const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.2 * 1.6 : 5.2;
    let f = 0, s = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) s -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) s += 1;
    // Jump
    if (keys.has("Space") && onGround) {
      interiorVel.y = 4;
      onGround = false;
    }
    // Gravity
    if (!onGround) interiorVel.y -= 9.8 * dt;
    // Horizontal move relative yaw
    const yaw = lookYaw;
    let mx = 0, mz = 0;
    if (f !== 0 || s !== 0) {
      const len = Math.hypot(f, s) || 1;
      f /= len; s /= len;
      mx = (Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * dt;
      mz = (Math.cos(yaw) * f - Math.sin(yaw) * s) * speed * dt;
    }
    let nx = interiorPos.x + mx;
    let nz = interiorPos.z + mz;
    let ny = interiorPos.y + interiorVel.y * dt;
    // Simple Box3 collision — clamp ke walkBounds pertama yang intersect
    // (iris 4: corridor bounds cukup, promenade/plaza iris 5+ presisi)
    let next = { x: nx, y: ny, z: nz };
    // Floor clamp
    if (next.y < 0) { next.y = 0; interiorVel.y = 0; onGround = true; }
    // Wall — if outside all walkBounds, reject XZ
    if (walkBounds.length > 0) {
      const inside = walkBounds.some((b) => b.containsPoint({ x: next.x, y: next.y, z: next.z } as import("three").Vector3));
      if (!inside) {
        // try X only, then Z only, else reject
        const tryX = walkBounds.some((b) => b.containsPoint({ x: nx, y: interiorPos.y, z: interiorPos.z } as import("three").Vector3));
        const tryZ = walkBounds.some((b) => b.containsPoint({ x: interiorPos.x, y: interiorPos.y, z: nz } as import("three").Vector3));
        if (tryX && !tryZ) next.z = interiorPos.z;
        else if (!tryX && tryZ) next.x = interiorPos.x;
        else if (!tryX && !tryZ) { next.x = interiorPos.x; next.z = interiorPos.z; }
      }
    }
    // Pitch clamp ±85°
    lookPitch = Math.max(-1.48, Math.min(1.48, lookPitch));
    interiorPos = next;
    opts.onLook?.(lookYaw, lookPitch);
  };

  const throttledPoll = (): void => {
    const now = Date.now();
    // Resend ~25Hz kalau arah masih ditekan (server drift-correct).
    if (now - lastSentAt > 40) sendMove(now);
  };
  let timer: ReturnType<typeof setInterval> | null = null;

  // Mouse-look (pointer lock). Yaw/pitch terakumulasi → scene.
  const onMouseMove = (e: MouseEvent): void => {
    if (!pointerLocked) return;
    const s = k();
    const sens = (s.lookSensitivity || 0.6) * 0.0022;
    const invY = s.invertLookY ? -1 : 1;
    lookYaw -= e.movementX * sens;
    lookPitch += e.movementY * sens * invY;
    // FPS interior: pitch clamp here too
    if (interiorMode === "FPS_INTERIOR") lookPitch = Math.max(-1.48, Math.min(1.48, lookPitch));
    opts.onLook?.(lookYaw, lookPitch);
  };
  const onCanvasClick = (): void => {
    const s = k();
    if (s.keyLook === "pointer-lock") {
      const el = document.body;
      el.requestPointerLock?.();
    }
  };
  const onMouseDown = (e: MouseEvent): void => {
    if (!pointerLocked || e.button !== 0) return;
    // left click while locked = fire
    if (hasLocal) {
      const intent: PlayerIntent = { playerId, entityId, type: "attack", seq: ++lastSeq, payload: { weapon: "plasma", targetId: entityId } };
      opts.send(intent);
    }
    opts.onWeapon?.();
  };
  const onLockChange = (): void => {
    pointerLocked = document.pointerLockElement === document.body;
  };

  return {
    attach() {
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("click", onCanvasClick);
      window.addEventListener("mousedown", onMouseDown);
      document.addEventListener("pointerlockchange", onLockChange);
      timer = setInterval(throttledPoll, 40);
      fpsTimer = setInterval(fpsTick, 1000 / 60);
    },
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onCanvasClick);
      window.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (timer) clearInterval(timer); timer = null;
      if (fpsTimer) clearInterval(fpsTimer); fpsTimer = null;
      keys.clear();
    },
    setLocalVessel(v) {
      localVessel = v;
      hasLocal = !!v;
      if (v) { playerId = v.owner ?? playerId; entityId = v.id; }
    },
    currentIntent() {
      return hasLocal ? { playerId, entityId, type: "move", seq: lastSeq, payload: {} } : undefined;
    },
    state() {
      const s = k();
      return {
        up: keys.has(s.keyForward),
        down: keys.has(s.keyReverse),
        left: keys.has(s.keyStrafeLeft),
        right: keys.has(s.keyStrafeRight),
        boost: keys.has(s.keyBoost),
        brake: keys.has(s.keyBrake),
      };
    },
    setInteriorMode(mode) { interiorMode = mode; },
    getInteriorMode() { return interiorMode; },
    setWalkBounds(bounds) { walkBounds = bounds; },
    getInteriorPosition() { return { ...interiorPos }; },
    setInteriorPosition(p) { interiorPos = { ...p }; interiorVel = { x: 0, y: 0, z: 0 }; onGround = true; },
    getLook() { return { yaw: lookYaw, pitch: lookPitch }; },
  };
}

// Map preset key → step multiplier (forward lebih panjang daripada strafe).
const KeyStep: Record<string, number> = {
  KeyW: 1.5,
  ArrowUp: 1.5,
  KeyS: 1.0,
  ArrowDown: 1.0,
  KeyA: 1.0,
  ArrowLeft: 1.0,
  KeyD: 1.0,
  ArrowRight: 1.0,
  KeyQ: 0.8,
  KeyE: 0.8,
};