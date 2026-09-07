// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// planetary/lightning.ts - 10.X.2 LightningEvent -> cloud flash + terrain/ocean/facility illumination + reflection. Zoom dari blueprint "LightningEvent { eventId, timestamp, position, direction, intensity, duration, cloudResponse, environmentResponse } -> cloud flash + sky/terrain/ocean/facility + reflection (bolt is only one part)".

// WIRE NOTE for SESSION 2: import { createLightningSystem, triggerLightning, tickLightning } from "./planetary/lightning" di scene3d/index.ts. Trigger deterministik dari EnvironmentalContext.tick % 600 + weather storm.

import * as THREE from "three";

export interface LightningEvent {
  eventId: string;
  timestamp: number; // ms
  position: { x: number; y: number; z: number }; // world pos near cloud
  intensity: number; // 0..1
  duration: number; // ms 120..280
  flashColor: number; // hex 0xffffff or 0xaaccff for storm
}

export interface LightningSystem {
  flashLight: THREE.PointLight; // 800m range, sky flash
  boltMesh: THREE.Line; // simple bolt
  lastEvent: LightningEvent | null;
  flashUntil: number;
}

export function createLightningSystem(): LightningSystem {
  const light = new THREE.PointLight(0xffffff, 0, 800, 1.8);
  light.name = "lightningFlash";
  light.visible = false;
  // Bolt: 3 segments jagged
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 300, 0),
    new THREE.Vector3(8, 200, 3),
    new THREE.Vector3(-6, 100, -4),
    new THREE.Vector3(0, 0, 0),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  line.name = "lightningBolt";
  return { flashLight: light, boltMesh: line, lastEvent: null, flashUntil: 0 };
}

/** Deterministik trigger: storm && tick % 600 == hash%600 -> lightning. Dipanggil tiap tick. */
export function shouldTriggerLightning(tick: number, planetSeed: number, isStorm: boolean): boolean {
  if (!isStorm) return false;
  const h = (planetSeed * 374761393 + tick * 668265263) % 600;
  return h < 3; // ~0.5% per tick ~ 3 per 60 sec storm
}

export function triggerLightning(sys: LightningSystem, pos: { x: number; y: number; z: number }, now: number): LightningEvent {
  const ev: LightningEvent = {
    eventId: `lt-${now}-${Math.floor(pos.x)}`,
    timestamp: now,
    position: pos,
    intensity: 0.7 + Math.random() * 0.3,
    duration: 120 + Math.random() * 160,
    flashColor: Math.random() > 0.5 ? 0xffffff : 0xaaccff,
  };
  sys.lastEvent = ev;
  sys.flashUntil = now + ev.duration;
  sys.flashLight.position.set(pos.x, pos.y, pos.z);
  sys.flashLight.color.set(ev.flashColor);
  sys.flashLight.intensity = 18 * ev.intensity;
  sys.flashLight.visible = true;
  sys.boltMesh.position.set(pos.x, 0, pos.z);
  (sys.boltMesh.material as THREE.LineBasicMaterial).opacity = 0.95;
  sys.boltMesh.visible = true;
  return ev;
}

export function tickLightning(sys: LightningSystem, now: number): void {
  if (now > sys.flashUntil) {
    sys.flashLight.visible = false;
    sys.boltMesh.visible = false;
    return;
  }
  const remaining = sys.flashUntil - now;
  const mat = sys.boltMesh.material as THREE.LineBasicMaterial;
  // Flash decay: 18 -> 2, bolt opacity 0.95 -> 0
  const t = remaining / (sys.lastEvent?.duration ?? 200);
  sys.flashLight.intensity = 2 + (sys.lastEvent?.intensity ?? 0.8) * 16 * t * (0.8 + Math.random() * 0.4);
  mat.opacity = t * 0.95;
  // Flicker 2x during flash
  if (Math.random() > 0.7) sys.flashLight.intensity *= 0.6;
}

export function getLightningThreat(sys: LightningSystem, now: number): number {
  if (!sys.lastEvent) return 0;
  const age = now - sys.lastEvent.timestamp;
  if (age > 5000) return 0;
  return sys.lastEvent.intensity * Math.max(0, 1 - age/5000);
}

