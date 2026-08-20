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
import { runScript, type RuntimeOptions } from "./runtime";
import { buildBindings } from "./bindings";

export interface ScriptResult {
  /** Lines emitted via print(). */
  output: string[];
  /** Key/value pairs emitted via emit() (machine-readable results). */
  results: Record<string, unknown>;
}

export interface ScriptOptions {
  /** Extra native bindings merged over the engine defaults. */
  extraBindings?: Record<string, unknown>;
  runtime?: RuntimeOptions;
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

  const bindings = await buildBindings();
  for (const [name, fn] of Object.entries(options.extraBindings ?? {})) {
    (bindings as Record<string, unknown>)[name] = fn;
  }

  const program = parse(source);
  await runScript(program, bindings, {
    stdout: (line) => output.push(line),
    log: (_level, message) => output.push(message),
    ...options.runtime,
  });

  return { output, results };
}

/** Parse-only helper for tooling that wants the AST without executing. */
export function parseScript(source: string) {
  return parse(source);
}