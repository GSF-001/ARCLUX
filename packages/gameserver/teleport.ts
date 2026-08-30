// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// teleport.ts — D-022 2-teleport mobility (recall + gate transit).

import type { Vec3 } from "./types";

export interface TeleportResult {
  success: boolean;
  from: Vec3;
  to: Vec3;
  reason?: string;
  cooldownTicks: number;
}

const TELEPORT_COOLDOWN = 300;
const MAX_TELEPORT_DISTANCE = 50000;

export function validateRecall(currentPos: Vec3, destination: Vec3): boolean {
  const dx = destination.x - currentPos.x;
  const dy = destination.y - currentPos.y;
  const dz = destination.z - currentPos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return dist <= MAX_TELEPORT_DISTANCE;
}

export function computeRecall(currentPos: Vec3, destination: Vec3): TeleportResult {
  if (!validateRecall(currentPos, destination)) {
    return { success: false, from: currentPos, to: destination, reason: "out_of_range", cooldownTicks: TELEPORT_COOLDOWN };
  }
  return { success: true, from: currentPos, to: destination, cooldownTicks: TELEPORT_COOLDOWN };
}

export function computeGateTransit(fromPos: Vec3, gatePos: Vec3, exitOffset: Vec3): TeleportResult {
  const dist = Math.sqrt(
    (gatePos.x - fromPos.x) ** 2 + (gatePos.y - fromPos.y) ** 2 + (gatePos.z - fromPos.z) ** 2
  );
  if (dist > 5000) {
    return { success: false, from: fromPos, to: gatePos, reason: "too_far_from_gate", cooldownTicks: TELEPORT_COOLDOWN };
  }
  const to = { x: gatePos.x + exitOffset.x, y: gatePos.y + exitOffset.y, z: gatePos.z + exitOffset.z };
  return { success: true, from: fromPos, to, cooldownTicks: TELEPORT_COOLDOWN };
}

export function applyTeleport(entityPos: Vec3, to: Vec3, dt: number): Vec3 {
  const lerp = Math.min(1, dt / 0.5);
  return {
    x: entityPos.x + (to.x - entityPos.x) * lerp,
    y: entityPos.y + (to.y - entityPos.y) * lerp,
    z: entityPos.z + (to.z - entityPos.z) * lerp,
  };
}
