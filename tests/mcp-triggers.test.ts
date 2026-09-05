// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for MCP self-triggering (no-reminder discovery): the server
// instructions plus per-tool descriptions must carry WHEN-triggers, so a
// model picks ARCLUX tools on its own instead of defaulting to manual
// reads/grep. If you add a tool, give it a trigger-first description or
// this suite fails.

import { describe, it, expect } from "vitest";
import { SERVER_INSTRUCTIONS, TOOLS } from "../packages/mcp/src/index";

const byName = new Map<string, { description?: string }>(
  (TOOLS as Array<{ name: string; description?: string }>).map((t) => [t.name, t]),
);

function desc(name: string): string {
  const d = byName.get(name)?.description ?? "";
  return d;
}

describe("SERVER_INSTRUCTIONS (connect-time workflow)", () => {
  it("exists and encodes the 4-step workflow", () => {
    expect(SERVER_INSTRUCTIONS.length).toBeGreaterThan(200);
    for (const rule of ["BEFORE opening", "NEVER guess", "BEFORE editing", "verify"]) {
      expect(SERVER_INSTRUCTIONS).toContain(rule);
    }
  });

  it("tells the model to prefer tools over shell reads", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/grep|shell/i);
  });
});

describe("trigger-first tool descriptions", () => {
  it("every tool has a non-trivial description", () => {
    for (const t of TOOLS as Array<{ name: string; description?: string }>) {
      expect((t.description ?? "").length, t.name).toBeGreaterThan(20);
    }
  });

  it("core workflow tools carry WHEN-triggers, not just WHAT", () => {
    expect(desc("analyze")).toMatch(/FIRST|before opening/i);
    expect(desc("config")).toMatch(/first contact|orientation|before/i);
    expect(desc("search")).toMatch(/INSTEAD OF|instead/i);
    expect(desc("file_info")).toMatch(/INSTEAD OF|instead|BEFORE editing/i);
    expect(desc("impact")).toMatch(/BEFORE editing|before/i);
    expect(desc("detect")).toMatch(/instead|verif/i);
    expect(desc("dependency_graph")).toMatch(/INSTEAD|instead/i);
    expect(desc("callgraph")).toMatch(/who-calls|tracing|instead/i);
  });
});
