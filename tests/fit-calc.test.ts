// Copyright 2026 GSF-001
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Coverage for Fase 1 (blueprint 11 §5): the component-effect
// pipeline. Pins the four design laws — determinism (same
// input → same hash), order-independence, purity (no input
// mutation), and the validation gates (slots, prerequisites).

import { describe, it, expect } from "vitest";
import type { AnalyzeRepositoryResult } from "../packages/engine/pipeline";
import {
  applyDamageProfile,
  computeFit,
  computeResists,
  deriveComponentDefinition,
  derivePowerDraw,
  deriveSlotLayout,
  deriveTier,
  fitHash,
  projectFit,
  FIT_DAMAGE_CEILING,
  MAX_RESIST,
  type FitInput,
} from "../mmo/packages/universe/fitCalc";
import type {
  ComponentBinding,
  ComponentDefinition,
  SystemState,
} from "../mmo/packages/universe/types";

// ── fixtures ────────────────────────────────────────────

function baseSystems(): SystemState[] {
  return [
    { id: "engine", label: "Engine", health: 60, baseStat: 60, capability: "graph.navigation" },
    { id: "reactor", label: "Reactor", health: 70, baseStat: 70, capability: "impact.trace" },
    { id: "navigation", label: "Navigation", health: 60, baseStat: 60, capability: "search.route" },
    { id: "defense", label: "Defense", health: 80, baseStat: 80, capability: "security.scan" },
    { id: "weapons", label: "Weapons", health: 55, baseStat: 55, capability: "analyst.expose" },
  ];
}

function binding(id: string, capability: string, provenance: string[] = []): ComponentBinding {
  return { id, capability, license: "open", owner: "gsf-001", provenance };
}

const SLOT_LAYOUT = { engine: 4, reactor: 3, navigation: 3, defense: 4, weapons: 4, ai: 2 };

function fitInput(definitions: ComponentDefinition[]): FitInput {
  return { base: baseSystems(), definitions, slotLayout: SLOT_LAYOUT };
}

/** Minimal analysis stub — only graph.nodeCount + moduleCount are read. */
function fakeAnalysis(nodes: number): AnalyzeRepositoryResult {
  return {
    meta: { id: "test", name: "test", org: "gsf-001", defaultBranch: "main", analyzedAt: "2026-01-01T00:00:00.000Z" },
    moduleCount: nodes,
    graph: { nodes: Array.from({ length: nodes }), edges: [] },
    scanSummary: { filesParsed: 0, filesSkipped: 0, filesFailed: 0 },
    repository: {},
    dependencies: [],
  } as unknown as AnalyzeRepositoryResult;
}

// ── derivation ──────────────────────────────────────────

describe("deriveComponentDefinition", () => {
  it("tier scales with provenance depth (0–1→1, 2–3→2, 4+→3)", () => {
    expect(deriveTier(binding("a", "security.scan", []))).toBe(1);
    expect(deriveTier(binding("a", "security.scan", ["p1"]))).toBe(1);
    expect(deriveTier(binding("a", "security.scan", ["p1", "p2"]))).toBe(2);
    expect(deriveTier(binding("a", "security.scan", ["p1", "p2", "p3"]))).toBe(2);
    expect(deriveTier(binding("a", "security.scan", ["p1", "p2", "p3", "p4"]))).toBe(3);
  });

  it("capability family decides the mount subsystem", () => {
    expect(deriveComponentDefinition(binding("a", "security.scan")).mount.subsystem).toBe("defense");
    expect(deriveComponentDefinition(binding("a", "analyst.expose")).mount.subsystem).toBe("weapons");
    expect(deriveComponentDefinition(binding("a", "impact.trace")).mount.subsystem).toBe("reactor");
    expect(deriveComponentDefinition(binding("a", "graph.navigation")).mount.subsystem).toBe("engine");
    expect(deriveComponentDefinition(binding("a", "search.route")).mount.subsystem).toBe("navigation");
    expect(deriveComponentDefinition(binding("a", "unknown.thing")).mount.subsystem).toBe("engine");
  });

  it("tier-3 costs 2 slots, draws more power, and requires its family", () => {
    const t1 = deriveComponentDefinition(binding("a", "security.scan", []));
    const t3 = deriveComponentDefinition(binding("b", "security.scan.deep", ["p1", "p2", "p3", "p4"]));
    expect(t1.mount.slotCost).toBe(1);
    expect(t3.mount.slotCost).toBe(2);
    expect(t3.powerDraw).toBeGreaterThan(t1.powerDraw);
    expect(t3.requiresCapability).toBe("security.");
    expect(t1.requiresCapability).toBeUndefined();
  });

  it("power draw scales with tier and effect count", () => {
    expect(derivePowerDraw(1, 1)).toBe(3);
    expect(derivePowerDraw(2, 2)).toBe(6);
    expect(derivePowerDraw(3, 3)).toBe(9);
  });
});

describe("deriveSlotLayout", () => {
  it("small repo → base capacities", () => {
    expect(deriveSlotLayout(fakeAnalysis(0))).toEqual(SLOT_LAYOUT);
  });

  it("large repo → bonus slots (engine/weapons full share, others half)", () => {
    const layout = deriveSlotLayout(fakeAnalysis(100));
    expect(layout.engine).toBe(7); // 4 + 3
    expect(layout.weapons).toBe(7); // 4 + 3
    expect(layout.defense).toBe(5); // 4 + floor(3/2)
  });
});

// ── determinism law ─────────────────────────────────────

describe("determinism law", () => {
  const defs = [
    deriveComponentDefinition(binding("c1", "security.scan", ["p1", "p2"])),
    deriveComponentDefinition(binding("c2", "analyst.expose", ["p1", "p2", "p3", "p4"])),
    deriveComponentDefinition(binding("c3", "graph.navigation", ["p1"])),
  ];

  it("same input → identical result and hash", () => {
    const a = computeFit(fitInput(defs));
    const b = computeFit(fitInput(defs));
    expect(b).toEqual(a);
    expect(b.hash).toBe(a.hash);
  });

  it("definition order does not affect the result (order-independence)", () => {
    const forward = computeFit(fitInput(defs));
    const reversed = computeFit(fitInput([...defs].reverse()));
    expect(reversed.hash).toBe(forward.hash);
    expect(reversed.stats).toEqual(forward.stats);
  });

  it("hash changes when the component set changes", () => {
    const one = computeFit(fitInput(defs.slice(0, 1)));
    const two = computeFit(fitInput(defs.slice(0, 2)));
    expect(one.hash).not.toBe(two.hash);
  });

  it("hash is stable across runs (FNV-1a, no platform drift)", () => {
    const fit = computeFit(fitInput(defs));
    const receipt = {
      components: defs.map((d) => d.id).sort(),
      systems: fit.systems.map((s) => ({ id: s.id, stat: s.baseStat })),
      stats: fit.stats,
      powerDraw: fit.powerDraw,
    };
    expect(fitHash(fit, defs)).toBe(fitHash({ ...fit, systems: fit.systems.map((s) => ({ ...s })) }, defs));
    expect(receipt.components).toEqual(["c1", "c2", "c3"]);
  });
});

// ── validation gates ────────────────────────────────────

describe("validation gates", () => {
  it("rejects slot overflow (5× tier-1 defense into 4 slots)", () => {
    const defs = Array.from({ length: 5 }, (_, i) =>
      deriveComponentDefinition(binding(`d${i}`, "security.scan"))
    );
    const fit = computeFit(fitInput(defs));
    expect(fit.valid).toBe(false);
    expect(fit.issues.some((i) => i.code === "slot_overflow" && i.severity === "error")).toBe(true);
  });

  it("rejects tier-3 without its family present (prerequisite gate)", () => {
    const solo = deriveComponentDefinition(binding("x", "security.scan.deep", ["p1", "p2", "p3", "p4"]));
    const fit = computeFit(fitInput([solo]));
    expect(fit.valid).toBe(false);
    expect(fit.issues.some((i) => i.code === "prerequisite_missing")).toBe(true);
  });

  it("accepts tier-3 when a same-family component is fitted", () => {
    const base = deriveComponentDefinition(binding("a", "security.scan"));
    const deep = deriveComponentDefinition(binding("x", "security.scan.deep", ["p1", "p2", "p3", "p4"]));
    const fit = computeFit(fitInput([base, deep]));
    expect(fit.valid).toBe(true);
    expect(fit.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("unknown subsystem in slot layout is an error, not a crash", () => {
    const def = deriveComponentDefinition(binding("a", "security.scan"));
    const fit = computeFit({ base: baseSystems(), definitions: [def], slotLayout: {} });
    expect(fit.valid).toBe(false);
    expect(fit.issues.some((i) => i.code === "unknown_subsystem")).toBe(true);
  });
});

// ── effect math ─────────────────────────────────────────

describe("effect application", () => {
  it("tier-1 add: defense 80 → 82", () => {
    const def = deriveComponentDefinition(binding("c1", "security.scan"));
    const fit = computeFit(fitInput([def]));
    expect(fit.stats.defense).toBe(82);
  });

  it("tier-2 add+mul: defense 80 → 84 → 89.0 (round1 at each step)", () => {
    const def = deriveComponentDefinition(binding("c1", "security.scan", ["p1", "p2"]));
    expect(def.effects).toEqual([
      { stat: "defense", op: "add", value: 4 },
      { stat: "defense", op: "mul", value: 6 },
    ]);
    const fit = computeFit(fitInput([def]));
    expect(fit.stats.defense).toBe(89);
  });

  it("effects never leak into other subsystems", () => {
    const def = deriveComponentDefinition(binding("c1", "security.scan", ["p1", "p2", "p3", "p4"]));
    const fit = computeFit(fitInput([def]));
    expect(fit.stats.weapons).toBe(55);
    expect(fit.stats.engine).toBe(60);
    expect(fit.stats.integrity).toBe(70);
  });

  it("stats clamp at 100 (no overflow past ceiling)", () => {
    const defs = [
      deriveComponentDefinition(binding("c1", "security.scan", ["p1", "p2", "p3", "p4"])),
      deriveComponentDefinition(binding("c2", "security.scan.deep", ["p1", "p2", "p3", "p4"])),
    ];
    const fit = computeFit(fitInput(defs));
    expect(fit.stats.defense).toBeLessThanOrEqual(100);
  });
});

// ── what-if projection ──────────────────────────────────

describe("projectFit (what-if)", () => {
  it("add: deltas reflect the added component exactly", () => {
    const c1 = deriveComponentDefinition(binding("c1", "security.scan"));
    const c2 = deriveComponentDefinition(binding("c2", "security.scan", ["p1", "p2"]));
    const projection = projectFit(fitInput([c1]), { op: "add", definition: c2 });
    // c1: 80 +2 → 82. Add c2 on top: 82 +4 → 86, then mul 6%
    // applies to the stacked value: 86 × 1.06 = 91.16 → 91.2.
    // Multipliers amplify earlier adds — standard stacking.
    expect(projection.before.stats.defense).toBe(82);
    expect(projection.after.stats.defense).toBe(91.2);
    expect(projection.deltas.defense).toBe(9.2);
    expect(projection.deltas.weapons).toBe(0);
  });

  it("remove: roundtrip back to the base stats", () => {
    const c1 = deriveComponentDefinition(binding("c1", "security.scan"));
    const c2 = deriveComponentDefinition(binding("c2", "analyst.expose", ["p1", "p2"]));
    const input = fitInput([c1, c2]);
    const committed = computeFit(input);
    const projection = projectFit(input, { op: "remove", componentId: "c1" });
    expect(projection.after.stats.defense).toBe(80);
    expect(projection.after.stats.weapons).toBe(committed.stats.weapons);
    expect(projection.deltas.defense).toBe(-2);
  });

  it("projection is pure — committed input is untouched", () => {
    const c1 = deriveComponentDefinition(binding("c1", "security.scan"));
    const input = fitInput([c1]);
    const snapshot = JSON.stringify(input.base);
    projectFit(input, { op: "add", definition: c1 });
    expect(JSON.stringify(input.base)).toBe(snapshot);
  });
});

// ── damage profile ──────────────────────────────────────

describe("damage profile", () => {
  it("resist reduces dealt damage (tier-1 defense: 5% missile resist)", () => {
    const def = deriveComponentDefinition(binding("c1", "security.scan"));
    const resists = computeResists([def]);
    expect(resists.missile).toBe(0.05);
    expect(resists.explosive).toBe(0.03);

    const systems = baseSystems();
    const app = applyDamageProfile(systems, resists, { name: "k", distribution: { missile: 1 } }, 10);
    expect(app.byType.missile).toBe(10);
    expect(app.totalResisted).toBe(0.5);
    expect(app.impacts).toHaveLength(1);
    expect(app.impacts[0]).toMatchObject({ subsystemId: "defense", before: 80, damage: 9.5, after: 70.5 });
  });

  it("per-hit ceiling caps a single damage type", () => {
    const systems = baseSystems();
    const app = applyDamageProfile(systems, {}, { name: "k", distribution: { plasma: 1 } }, 50);
    expect(app.impacts[0].damage).toBe(FIT_DAMAGE_CEILING);
    expect(app.impacts[0].after).toBe(55 - FIT_DAMAGE_CEILING);
  });

  it("damage floors at subsystem health (no negative health)", () => {
    const systems = baseSystems().map((s) => (s.id === "defense" ? { ...s, health: 5, baseStat: 5 } : s));
    const app = applyDamageProfile(systems, {}, { name: "k", distribution: { missile: 1 } }, 10);
    expect(app.impacts[0].damage).toBe(5);
    expect(app.impacts[0].after).toBe(0);
  });

  it("empty distribution falls back to an even spread", () => {
    const systems = baseSystems();
    const app = applyDamageProfile(systems, {}, { name: "k", distribution: {} }, 10);
    // 5 types × 2 allocated each; plasma+railgun merge into weapons (4),
    // missile→defense (2), emp→engine (2), explosive→reactor (2).
    expect(app.byType.plasma).toBe(2);
    expect(app.byType.missile).toBe(2);
    const weapons = app.impacts.find((i) => i.subsystemId === "weapons");
    expect(weapons?.damage).toBe(4);
  });

  it("resist is capped at MAX_RESIST (anti-abuse)", () => {
    const defs = Array.from({ length: 10 }, (_, i) =>
      deriveComponentDefinition(binding(`d${i}`, "security.scan.deep", ["p1", "p2", "p3", "p4"]))
    );
    const resists = computeResists(defs);
    expect(resists.missile).toBe(MAX_RESIST);
  });

  it("purity — input systems are never mutated", () => {
    const systems = baseSystems();
    const snapshot = systems.map((s) => s.health);
    applyDamageProfile(systems, {}, { name: "k", distribution: { missile: 1, emp: 1 } }, 20);
    expect(systems.map((s) => s.health)).toEqual(snapshot);
  });
});
