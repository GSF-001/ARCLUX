// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/input.ts — FREE-FLIGHT control binding (01 §4/§6).
// WASD/arrows/throttle + pointer-look → kirim `move` intent ke server.
// Server-authoritative (D-008): client cuma ngirim intent, posisi datang dari sim.
// Tidak ada teleport/hack posisi: intent `move` = target thrust, server yang integrasi.

import type { PlayerIntent, Vec3, VesselEntity } from "../../../../packages/gameserver/types";

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
  state(): { up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean };
}

const KEY_W = "KeyW", KEY_A = "KeyA", KEY_S = "KeyS", KEY_D = "KeyD", KEY_ARROW_UP = "ArrowUp", KEY_ARROW_DOWN = "ArrowDown", KEY_ARROW_LEFT = "ArrowLeft", KEY_ARROW_RIGHT = "ArrowRight", KEY_SHIFT = "ShiftLeft", KEY_SPACE = "Space", KEY_CTRL = "ControlLeft";

export function initInput(opts: { send: (intent: PlayerIntent) => void; onLocalVessel?: (v: VesselEntity) => void }): InputHandle {
  const keys = new Set<string>();
  let playerId = "player-1";
  let entityId = "vessel-1";
  let hasLocal = false;
  let lastSeq = 0;
  let lastSentAt = 0;
  let lastState = JSON.stringify(keys);
  let localVessel: VesselEntity | undefined;

  const sendMove = (now: number): void => {
    if (!hasLocal || !localVessel) return;
    const thrust = 1; // unit m/s^2 target offset (server clamps via Newton)
    const base = localVessel.position;
    let tx = base.x, ty = base.y, tz = base.z;
    if (keys.has(KEY_W) || keys.has(KEY_ARROW_UP)) tz -= 2600;
    if (keys.has(KEY_S) || keys.has(KEY_ARROW_DOWN)) tz += 2600;
    if (keys.has(KEY_A) || keys.has(KEY_ARROW_LEFT)) tx -= 2600;
    if (keys.has(KEY_D) || keys.has(KEY_ARROW_RIGHT)) tx += 2600;
    if (keys.has(KEY_SPACE)) ty += 2600;
    if (keys.has(KEY_CTRL)) ty -= 2600;
    const boost = keys.has(KEY_SHIFT) ? 2.2 : 1;
    // Hanya kirim saat ada movement aktif (hemat bandwidth, deterministic).
    if (tx === base.x && ty === base.y && tz === base.z) return;
    void thrust;
    const target: Vec3 = { x: tx, y: ty, z: tz };
    const intent: PlayerIntent = { playerId, entityId, type: "move", seq: ++lastSeq, payload: { ...target } };
    opts.send(intent);
    lastSentAt = now;
    lastState = JSON.stringify(keys);
    opts.onLocalVessel?.(localVessel);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if ([KEY_W, KEY_A, KEY_S, KEY_D, KEY_ARROW_UP, KEY_ARROW_DOWN, KEY_ARROW_LEFT, KEY_ARROW_RIGHT, KEY_SHIFT, KEY_SPACE, KEY_CTRL].includes(e.code)) {
      e.preventDefault();
      keys.add(e.code);
      sendMove(Date.now());
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    if (keys.delete(e.code)) sendMove(Date.now());
  };

  const onBlur = (): void => { keys.clear(); };

  const throttledPoll = (): void => {
    const now = Date.now();
    // Kirim ulang ~25Hz kalau arah masih ditekan (server drift-correct). 
    if (now - lastSentAt > 40) sendMove(now);
  };
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    attach() {
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      timer = setInterval(throttledPoll, 40);
    },
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      if (timer) clearInterval(timer); timer = null;
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
      return { up: keys.has(KEY_W) || keys.has(KEY_ARROW_UP), down: keys.has(KEY_S) || keys.has(KEY_ARROW_DOWN), left: keys.has(KEY_A) || keys.has(KEY_ARROW_LEFT), right: keys.has(KEY_D) || keys.has(KEY_ARROW_RIGHT), boost: keys.has(KEY_SHIFT) };
    },
  };
}