// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/lightning.ts - 10.X.2 lightning event chain.
// Deterministic storm strikes: a jagged bolt plus a wide sky flash that
// illuminates terrain, ocean, and facilities. The bolt is one part of the
// event; flashLevel exposes the environment response for other resolvers.
// Visual-only: no gameplay state is read or written.

import * as THREE from "three";

const FLASH_RANGE = 800;
const BOLT_SEGMENTS = 7;
const BOLT_HEIGHT = 300;
const TRIGGER_MOD = 600;
const TRIGGER_THRESHOLD = 3;
const THREAT_WINDOW_MS = 5000;

export interface LightningEvent {
  eventId: string;
  timestamp: number; // ms
  position: { x: number; y: number; z: number };
  intensity: number; // 0..1
  duration: number; // ms
  flashColor: number;
}

export interface LightningSystem {
  flashLight: THREE.PointLight;
  boltMesh: THREE.Line;
  lastEvent: LightningEvent | null;
  flashUntil: number;
  flashLevel: number; // 0..1 current environment illumination
}

export function createLightningSystem(): LightningSystem {
  const light = new THREE.PointLight(0xffffff, 0, FLASH_RANGE, 1.8);
  light.name = "lightningFlash";
  light.visible = false;
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, BOLT_HEIGHT, 0),
    new THREE.Vector3(8, 200, 3),
    new THREE.Vector3(-6, 100, -4),
    new THREE.Vector3(0, 0, 0),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  line.name = "lightningBolt";
  line.frustumCulled = false;
  return { flashLight: light, boltMesh: line, lastEvent: null, flashUntil: 0, flashLevel: 0 };
}

/** Deterministic strike schedule: ~3 strikes per 600 ticks of storm. */
export function shouldTriggerLightning(tick: number, planetSeed: number, isStorm: boolean): boolean {
  if (!isStorm) return false;
  const h = (planetSeed * 374761393 + tick * 668265263) % TRIGGER_MOD;
  return h < TRIGGER_THRESHOLD;
}

function hash2(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Rebuild the bolt as a deterministic jagged path for this strike. */
function rebuildBolt(sys: LightningSystem, seedX: number, seedZ: number): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= BOLT_SEGMENTS; i++) {
    const t = i / BOLT_SEGMENTS;
    const spread = (1 - t) * 22;
    const x = (hash2(seedX + i * 31, seedZ) - 0.5) * 2 * spread;
    const z = (hash2(seedZ + i * 57, seedX) - 0.5) * 2 * spread;
    pts.push(new THREE.Vector3(x, BOLT_HEIGHT * (1 - t), z));
  }
  sys.boltMesh.geometry.dispose();
  sys.boltMesh.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

export function triggerLightning(
  sys: LightningSystem,
  pos: { x: number; y: number; z: number },
  now: number,
): LightningEvent {
  const sx = Math.floor(pos.x);
  const sz = Math.floor(pos.z);
  const r1 = hash2(sx, Math.floor(now / 1000));
  const r2 = hash2(sz, Math.floor(now / 700));
  const r3 = hash2(sx + sz, Math.floor(now / 1300));
  const ev: LightningEvent = {
    eventId: `lt-${Math.floor(now)}-${sx}-${sz}`,
    timestamp: now,
    position: pos,
    intensity: 0.7 + r1 * 0.3,
    duration: 120 + r2 * 160,
    flashColor: r3 > 0.5 ? 0xffffff : 0xaaccff,
  };
  sys.lastEvent = ev;
  sys.flashUntil = now + ev.duration;
  sys.flashLight.position.set(pos.x, pos.y, pos.z);
  sys.flashLight.color.set(ev.flashColor);
  sys.flashLight.intensity = 18 * ev.intensity;
  sys.flashLight.visible = true;
  rebuildBolt(sys, sx, sz);
  sys.boltMesh.position.set(pos.x, 0, pos.z);
  (sys.boltMesh.material as THREE.LineBasicMaterial).opacity = 0.95;
  sys.boltMesh.visible = true;
  sys.flashLevel = ev.intensity;
  return ev;
}

/**
 * Decay the flash. Flicker derives from the clock, so replays are stable.
 * flashLevel tracks the environment response for terrain/ocean/facility use.
 */
export function tickLightning(sys: LightningSystem, now: number): void {
  if (!sys.lastEvent || now > sys.flashUntil) {
    sys.flashLight.visible = false;
    sys.boltMesh.visible = false;
    sys.flashLevel = 0;
    return;
  }
  const remaining = sys.flashUntil - now;
  const duration = sys.lastEvent.duration || 200;
  const t = remaining / duration;
  const flicker = 0.8 + 0.2 * Math.sin(now * 0.11 + sys.lastEvent.timestamp * 0.001);
  const dip = Math.sin(now * 0.031) > 0.55 ? 0.6 : 1;
  sys.flashLight.intensity = (2 + sys.lastEvent.intensity * 16 * t * flicker) * dip;
  (sys.boltMesh.material as THREE.LineBasicMaterial).opacity = t * 0.95;
  sys.flashLevel = sys.lastEvent.intensity * t;
}

/** Decaying strike threat for audio and exposure resolvers. */
export function getLightningThreat(sys: LightningSystem, now: number): number {
  if (!sys.lastEvent) return 0;
  const age = now - sys.lastEvent.timestamp;
  if (age > THREAT_WINDOW_MS) return 0;
  return sys.lastEvent.intensity * Math.max(0, 1 - age / THREAT_WINDOW_MS);
}

/**
 * F2: real strike distance for audio/exposure resolvers. Fresh (<8s)
 * strike → true camera-to-strike distance; stale/missing → documented
 * fallback (the old hardcoded 2800, now a named constant).
 */
export const STALE_STRIKE_DISTANCE = 2800;
const STRIKE_FRESH_MS = 8000;

export function strikeDistanceTo(
  cam: { x: number; y: number; z: number },
  lastEvent: LightningEvent | null,
  nowMs: number,
  fallback = STALE_STRIKE_DISTANCE,
): number {
  if (!lastEvent) return fallback;
  const age = nowMs - lastEvent.timestamp;
  if (age < 0 || age > STRIKE_FRESH_MS) return fallback;
  const dx = cam.x - lastEvent.position.x;
  const dy = cam.y - lastEvent.position.y;
  const dz = cam.z - lastEvent.position.z;
  return Math.hypot(dx, Math.hypot(dy, dz));
}
