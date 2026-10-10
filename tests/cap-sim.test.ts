// Copyright 2026 GSF-001
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Coverage for Fase 1 (blueprint 11 §5): the deterministic
// per-tick capacitor simulation. Pins exact depletion ticks,
// warning accounting, verdicts, and the determinism law.

import { describe, it, expect } from "vitest";
import {
  capacitorBudget,
  requiredRegenForStability,
  simulateCapacitor,
  sustainableDraw,
  CAP_WARNING_THRESHOLD,
  type CapacitorState,
} from "../mmo/packages/universe/capSim";
import { deriveComponentDefinition } from "../mmo/packages/universe/fitCalc";
import type { ComponentBinding } from "../mmo/packages/universe/types";

function state(current: number, capacity = 100, regenPerTick = 0): CapacitorState {
  return { capacity, current, regenPerTick };
}

function binding(id: string, capability: string, provenance: string[] = []): ComponentBinding {
  return { id, capability, license: "open", owner: "gsf-001", provenance };
}

describe("simulateCapacitor", () => {
  it("stable when regen ≥ draw — level never falls", () => {
    const sim = simulateCapacitor(state(100, 100, 4), 3, 10);
    expect(sim.verdict).toBe("stable");
    expect(sim.firstDepletionTick).toBeUndefined();
    expect(sim.endLevel).toBe(100); // regen clamps at capacity
    expect(sim.history.every((t) => t.level === 100)).toBe(true);
  });

  it("exact depletion tick: 100 capacity, draw 10, regen 0 → tick 10", () => {
    const sim = simulateCapacitor(state(100), 10, 10);
    expect(sim.verdict).toBe("unstable");
    expect(sim.firstDepletionTick).toBe(10);
    expect(sim.history[9]).toMatchObject({ tick: 10, level: 0, depleted: true });
    expect(sim.minLevel).toBe(0);
  });

  it("partial regen delays depletion: draw 10, regen 4, current 50 → tick 9", () => {
    const sim = simulateCapacitor(state(50, 100, 4), 10, 12);
    expect(sim.firstDepletionTick).toBe(9);
    // 50 → 44 → 38 → 32 → 26 → 20 → 14 → 8 → 2 → 0
    expect(sim.history[0].level).toBe(44);
    expect(sim.history[7].level).toBe(2);
  });

  it("warning accounting: draw 20, regen 0 → warning from tick 4 (≤25%)", () => {
    const sim = simulateCapacitor(state(100), 20, 10);
    expect(sim.history[3]).toMatchObject({ tick: 4, level: 20, warning: true });
    expect(sim.history[2].warning).toBe(false); // tick 3 = 40
    expect(sim.warningRatio).toBe(0.7); // ticks 4..10
    expect(sim.verdict).toBe("unstable");
  });

  it("sustainable: drains but survives the horizon", () => {
    const sim = simulateCapacitor(state(100, 100, 4), 5, 5);
    expect(sim.verdict).toBe("sustainable");
    expect(sim.firstDepletionTick).toBeUndefined();
    expect(sim.endLevel).toBe(95);
  });

  it("zero ticks → empty history, no crash", () => {
    const sim = simulateCapacitor(state(50), 10, 0);
    expect(sim.history).toEqual([]);
    expect(sim.minLevel).toBe(50);
    expect(sim.endLevel).toBe(50);
  });

  it("zero-capacity capacitor is always depleted", () => {
    const sim = simulateCapacitor(state(0, 0, 5), 0, 3);
    expect(sim.verdict).toBe("stable"); // draw 0 ≤ regen 5
    expect(sim.history.every((t) => t.depleted)).toBe(true);
  });

  it("regen never overflows past capacity (clamp)", () => {
    const sim = simulateCapacitor(state(90, 100, 50), 0, 3);
    expect(sim.endLevel).toBe(100);
    expect(sim.history.every((t) => t.level <= 100)).toBe(true);
  });

  it("determinism: identical runs produce identical histories", () => {
    const a = simulateCapacitor(state(77, 100, 3), 7, 25);
    const b = simulateCapacitor(state(77, 100, 3), 7, 25);
    expect(b).toEqual(a);
  });

  it("warning threshold constant is 25%", () => {
    expect(CAP_WARNING_THRESHOLD).toBe(0.25);
  });
});

describe("capacitorBudget", () => {
  it("sums power draw across the fit", () => {
    const defs = [
      deriveComponentDefinition(binding("a", "security.scan")),
      deriveComponentDefinition(binding("b", "analyst.expose", ["p1", "p2"])),
    ];
    expect(capacitorBudget(defs)).toBe(3 + 6);
  });

  it("empty fit draws nothing", () => {
    expect(capacitorBudget([])).toBe(0);
  });
});

describe("stability helpers", () => {
  it("requiredRegenForStability ↔ sustainableDraw are inverses", () => {
    const draw = 7.5;
    expect(sustainableDraw(requiredRegenForStability(draw))).toBe(draw);
    expect(requiredRegenForStability(0)).toBe(0);
  });
});
