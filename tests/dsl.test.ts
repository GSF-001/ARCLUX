/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Tests for the ARCLUX scripting language (packages/dsl): lexer, parser,
 * runtime, and the registry-driven bindings. The bindings tests run real
 * engine code (analyzeRepository on fixtures) — the language is a thin
 * layer, so the tests prove the glue, not a toy interpreter.
 */

import { describe, expect, it } from "vitest";
import { lex } from "../packages/dsl/lexer";
import { parse } from "../packages/dsl/parser";
import { runScriptSource, runScriptFile } from "../packages/dsl/script";
import { buildBindings, registeredExtensions, DOCTOR_CHECK_IDS } from "../packages/dsl/bindings";
import { stringify } from "../packages/dsl/runtime";
import { join } from "node:path";

describe("lexer", () => {
  it("tokenizes literals, identifiers, and operators", () => {
    const tokens = lex('let x = 42 + "hi"').filter((t) => t.kind !== "eof");
    expect(tokens.map((t) => t.value)).toEqual(["let", "x", "=", "42", "+", '"hi"']);
  });

  it("skips # comments", () => {
    const tokens = lex("# hello\nlet y = 1").filter((t) => t.kind !== "eof");
    expect(tokens.map((t) => t.value)).toEqual(["let", "y", "=", "1"]);
  });

  it("rejects unterminated strings", () => {
    expect(() => lex('"oops')).toThrow(/Unterminated string/);
  });
});

describe("parser", () => {
  it("parses a let + expression program", () => {
    const program = parse('let x = 1 + 2 * 3');
    expect(program.type).toBe("Program");
    expect(program.body).toHaveLength(1);
  });

  it("parses if/else with blocks", () => {
    const program = parse('if a == 1 { let b = 2 } else { let c = 3 }');
    expect(program.body[0].type).toBe("If");
  });

  it("parses for with where clause", () => {
    const program = parse('for x in items where x > 1 { print(x) }');
    const node = program.body[0];
    expect(node.type).toBe("For");
    expect(node.where).not.toBeNull();
  });

  it("rejects an unterminated block", () => {
    expect(() => parse("if x { let y = 1")).toThrow(/Unterminated block/);
  });
});

describe("runtime", () => {
  it("runs arithmetic and string concat", async () => {
    const out: string[] = [];
    await runScriptSource('let a = 2 + 3\nprint(a * 2)\nprint("v=" + a)', {
      runtime: { stdout: (l) => out.push(l) },
    });
    expect(out).toEqual(["10", "v=5"]);
  });

  it("supports if/else control flow", async () => {
    const out: string[] = [];
    await runScriptSource('if 2 > 1 { print("yes") } else { print("no") }', {
      runtime: { stdout: (l) => out.push(l) },
    });
    expect(out).toEqual(["yes"]);
  });

  it("iterates lists and filters with where", async () => {
    const out: string[] = [];
    await runScriptSource(
      'let nums = [1, 2, 3, 4]\nfor n in nums where n % 2 == 0 { print(n) }',
      { runtime: { stdout: (l) => out.push(l) } }
    );
    expect(out).toEqual(["2", "4"]);
  });

  it("calls user-defined functions", async () => {
    const out: string[] = [];
    await runScriptSource(
      'fn double(x) { return x * 2 }\nprint(double(21))',
      { runtime: { stdout: (l) => out.push(l) } }
    );
    expect(out).toEqual(["42"]);
  });

  it("raises on undefined variables", async () => {
    await expect(runScriptSource("print(nope)")).rejects.toThrow(/Undefined variable/);
  });

  it("guards against infinite loops", async () => {
    await expect(
      runScriptSource("for x in [1] { while x == 1 { print(1) } }", {
        runtime: { maxIterations: 100 },
      })
    ).rejects.toThrow(/possible infinite loop/);
  });
});

describe("bindings — language surface", () => {
  it("len, sum, filter, sort work on lists", async () => {
    const out: string[] = [];
    await runScriptSource(
      'let l = [3, 1, 2]\nprint(len(l))\nprint(sum(l))\nlet f = filter(l, null, ">", 1)\nprint(len(f))\nprint(sort(l))',
      { runtime: { stdout: (l) => out.push(l) } }
    );
    expect(out).toEqual(["3", "6", "2", "[1, 2, 3]"]);
  });

  it("while loops with break work", async () => {
    const out: string[] = [];
    await runScriptSource('let i = 0\nwhile i < 5 {\n i = i + 1\n if i == 3 { break }\n}\nprint(i)', {
      runtime: { stdout: (l) => out.push(l) },
    });
    expect(out).toEqual(["3"]);
  });

  it("extensions() reflects the parser registry (auto-discovery)", async () => {
    const exts = registeredExtensions();
    expect(exts).toContain(".ts");
    expect(exts).toContain(".py");
  });

  it("checkids() exposes the wired detector table", async () => {
    const ids = DOCTOR_CHECK_IDS;
    expect(ids).toContain("orphanFiles");
    expect(ids).toContain("orphanIntegration");
  });
});

describe("bindings — engine integration (real analysis)", () => {
  const fixture = join(__dirname, "fixtures", "pipeline-basic");

  it("analyze → doctor → impact end-to-end", async () => {
    const out: string[] = [];
    const src = `
let repo = analyze(${JSON.stringify(fixture)})
print(repo.moduleCount)
let d = doctor(repo)
print(d.total)
let imp = impact(repo, "service.ts")
print(imp.affected)
let g = graph(repo)
print(g.nodes)
let s = search(repo, "zzz-absent")
print(len(s))
`;
    await runScriptSource(src, { runtime: { stdout: (l) => out.push(l) } });
    expect(Number(out[0])).toBeGreaterThan(0);
    expect(Number(out[1])).toBeGreaterThan(0);
    expect(Number(out[2])).toBeGreaterThan(0);
    expect(Number(out[3])).toBeGreaterThan(0);
    expect(out[4]).toBe("0"); // no searchable "zzz-absent" in fixture
  });

  it("orphan findings carry classification via detail", async () => {
    const out: string[] = [];
    const src = `
let repo = analyze(${JSON.stringify(fixture)})
let orphans = check("orphanFiles", repo)
for o in orphans { print(o.filePath + "=" + o.classification) }
`;
    await runScriptSource(src, { runtime: { stdout: (l) => out.push(l) } });
    for (const line of out) {
      expect(line).toMatch(/^(.*)=(dead|unwired|ambiguous|)$/);
    }
  });

  it("runs a real .arclux file from disk", async () => {
    const out = await runScriptFile(join(__dirname, "fixtures", "sample.arclux"), {
      runtime: { stdout: () => {} },
    });
    expect(Array.isArray(out.output)).toBe(true);
  });

  it("stringify renders values for reports", () => {
    expect(stringify([1, "a", null])).toBe('[1, a, null]');
    expect(stringify({ x: 1 })).toBe('{ x: 1 }');
  });
});