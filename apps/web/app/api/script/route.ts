// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { runScriptSource } from "@/packages/dsl/script";

interface ScriptRequestBody {
  /** The .arclux program source to run. */
  source: string;
  /**
   * Optional execution budget: max loop iterations (runtime guard).
   * Defaults to the runtime's own built-in limit.
   */
  maxIterations?: number;
}

/**
 * POST /api/script { source }
 *
 * HTTP counterpart of `arclux script`: runs an ARCLUX DSL program
 * server-side and returns its print() output plus emit() results as
 * JSON. The DSL is sandboxed by construction — bindings only expose
 * engine analysis capabilities (analyze/doctor/impact/search/...), no
 * fs/network primitives; remote analyze targets go through the same
 * SSRF guards as every other route.
 */
export async function POST(request: NextRequest) {
  let body: ScriptRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.source || typeof body.source !== "string") {
    return NextResponse.json({ error: "`source` is required" }, { status: 400 });
  }
  if (body.source.length > 100_000) {
    return NextResponse.json({ error: "`source` too large (max 100KB)" }, { status: 413 });
  }

  try {
    const result = await runScriptSource(body.source, {
      captureValues: true,
      runtime: body.maxIterations ? { maxIterations: body.maxIterations } : undefined,
    });

    return NextResponse.json(
      {
        output: result.output,
        results: result.results,
        entries: result.entries ?? [],
      },
      { status: 200 }
    );
  } catch (err) {
    // Script-level errors (parse errors, runtime errors, unknown
    // bindings) are user-facing — return the message plus source
    // location when the error carries one (ParseError does).
    const message = err instanceof Error ? err.message : String(err);
    const line = (err as { line?: number }).line;
    const column = (err as { column?: number }).column;
    console.error("Error in /api/script:", message);
    return NextResponse.json(
      { error: message, line: typeof line === "number" ? line : undefined, column: typeof column === "number" ? column : undefined },
      { status: 400 }
    );
  }
}