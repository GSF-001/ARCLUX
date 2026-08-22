// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// High-level entry for running `.arclux` script files. One function:
// read file → parse → bind engine → execute. Used by the CLI
// (`arclux script <file>`), the shell (`run <file>`), and tests.

import { readFile } from "node:fs/promises";
import { parse } from "./parser";
import { runScript, stringify, type RuntimeOptions } from "./runtime";
import { buildBindings } from "./bindings";

export interface ScriptResult {
  /** Lines emitted via print(). */
  output: string[];
  /** Key/value pairs emitted via emit() (machine-readable results). */
  results: Record<string, unknown>;
  /** Ordered print/log transcript — present only when captureValues. */
  entries?: ScriptEntry[];
}

export interface ScriptOptions {
  /** Extra native bindings merged over the engine defaults. */
  extraBindings?: Record<string, unknown>;
  runtime?: RuntimeOptions;
  /**
   * When true, print()/log() calls are additionally captured as an
   * ordered transcript in the result (`entries`), with raw values for
   * print() so UIs can render structured data instead of strings.
   * Purely additive — output/results behavior is unchanged.
   */
  captureValues?: boolean;
}

/** One ordered transcript entry from a captureValues run. */
export interface ScriptEntry {
  kind: "print" | "log";
  /** Stringified line exactly as stdout received it. */
  text: string;
  /** JSON-safe raw value for print(); undefined for log(). */
  value?: unknown;
}

export async function runScriptFile(
  filePath: string,
  options: ScriptOptions = {}
): Promise<ScriptResult> {
  const source = await readFile(filePath, "utf-8");
  return runScriptSource(source, options);
}

export async function runScriptSource(
  source: string,
  options: ScriptOptions = {}
): Promise<ScriptResult> {
  const output: string[] = [];
  const results: Record<string, unknown> = {};
  const entries: ScriptEntry[] = [];

  const bindings = await buildBindings();
  for (const [name, fn] of Object.entries(options.extraBindings ?? {})) {
    (bindings as Record<string, unknown>)[name] = fn;
  }

  if (options.captureValues) {
    // Wrap (never replace the logic of) print/log so UIs get an ordered
    // transcript with raw values. The original binding still produces
    // the stdout line via stringify — identical output, extra capture.
    const originalPrint = bindings.print;
    const originalLog = bindings.log;
    bindings.print = {
      kind: "native",
      name: "print",
      fn: async (args, ctx) => {
        const raw = args[0] ?? null;
        entries.push({ kind: "print", text: stringify(raw), value: jsonSafe(raw) });
        return originalPrint.fn(args, ctx);
      },
    };
    bindings.log = {
      kind: "native",
      name: "log",
      fn: async (args, ctx) => {
        const level = typeof args[0] === "string" ? args[0] : "info";
        const message = args.length > 1 ? stringify(args[1]) : "";
        entries.push({ kind: "log", text: message });
        return originalLog.fn(args, ctx);
      },
    };
  }

  const program = parse(source);
  await runScript(program, bindings, {
    stdout: (line) => output.push(line),
    log: (_level, message) => output.push(message),
    ...options.runtime,
  });

  return options.captureValues ? { output, results, entries } : { output, results };
}

/** ArcluxValue -> JSON-safe (functions become "<fn name>" strings). */
function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return value;
  if ("kind" in value && (value as { kind: string }).kind === "native") {
    return `<fn ${(value as { name?: string }).name ?? "?"}>`;
  }
  if ("kind" in value && (value as { kind: string }).kind === "script") {
    return `<fn ${(value as { name?: string }).name ?? "?"}>`;
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = jsonSafe(v);
  }
  return out;
}

/** Parse-only helper for tooling that wants the AST without executing. */
export function parseScript(source: string) {
  return parse(source);
}