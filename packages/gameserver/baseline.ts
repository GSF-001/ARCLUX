// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// baseline.ts — D-019 Universal Baseline (gravity immunity + baseline physics).

import type { Vec3 } from "./types";

export const UNIVERSAL_BASELINE = {
  gravityConstant: 0,
  timeDilation: 1.0,
  maxEntitySpeed: 250,
  tickDuration: 0.1,
};

export function applyBaseline(state: { position: Vec3; velocity: Vec3 }, dt: number): Vec3 {
  const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2);
  const clamped = Math.min(speed, UNIVERSAL_BASELINE.maxEntitySpeed);
  if (speed > 0) {
    const scale = clamped / speed;
    return {
      x: state.velocity.x * scale * dt,
      y: state.velocity.y * scale * dt,
      z: state.velocity.z * scale * dt,
    };
  }
  return { x: 0, y: 0, z: 0 };
}

export function isWithinBaseline(entitySpeed: number): boolean {
  return entitySpeed <= UNIVERSAL_BASELINE.maxEntitySpeed;
}

export function computeTimeDilation(factor: number): number {
  return Math.max(0.1, Math.min(2.0, factor * UNIVERSAL_BASELINE.timeDilation));
}
