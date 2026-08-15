// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { runDiagnostics } from "@/packages/diagnostics/DiagnosticEngine";
import { attachImpactContextToAll } from "@/packages/diagnostics/ErrorContext";
import { toDiagnosticEventsForAll } from "@/packages/diagnostics/DiagnosticEvent";
import { getFixSuggestion } from "@/packages/diagnostics/FixSuggestion";
import { isArcluxError } from "@/packages/shared/errors";

/** Maps internal ArcluxErrorCode to an HTTP status — mirrors /api/analyze, /api/doctor */
function statusForErrorCode(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "UNSUPPORTED_LANGUAGE":
      return 422;
    case "CLONE_FAILED":
    case "PARSE_FAILED":
    case "INDEX_FAILED":
    case "GRAPH_BUILD_FAILED":
      return 502;
    default:
      return 500;
  }
}

interface DiagnosticsRequestBody {
  repoUrl: string;
  branch?: string;
}

/**
 * POST /api/diagnostics { repoUrl, branch? }
 *
 * HTTP counterpart of `arclux diagnose` (apps/cli/diagnose.ts): runs the 3
 * wired diagnostic adapters (circularDependency, deadCode,
 * ambiguousSymbolResolution), attaches impact context (using the shared
 * count-only cache from the 2026-08-14 OOM fix -- see progres/bugs.md),
 * and returns per-location events with fix suggestions attached. Replaces
 * the previous empty-array placeholder (KI-029 scaffold).
 *
 * Same no-cache cost as /api/analyze and /api/doctor: full clone + index
 * per call. Was GET with no params before (the placeholder); now POST with
 * a body, matching the /api/doctor pattern this mirrors.
 */
export async function POST(request: NextRequest) {
  let body: DiagnosticsRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.repoUrl || typeof body.repoUrl !== "string") {
    return NextResponse.json({ error: "`repoUrl` is required" }, { status: 400 });
  }

  try {
    const result = await analyzeRepository({
      repoUrl: body.repoUrl,
      branch: body.branch,
    });

    const findings = runDiagnostics(result.repository);
    const withContext = attachImpactContextToAll(result.repository, findings);
    const events = toDiagnosticEventsForAll(withContext);

    const seenCheckIds = new Set<string>();
    const suggestions: Record<string, string> = {};
    for (const finding of findings) {
      if (seenCheckIds.has(finding.checkId)) continue;
      seenCheckIds.add(finding.checkId);
      const suggestion = getFixSuggestion(finding);
      if (suggestion) suggestions[suggestion.checkId] = suggestion.suggestion;
    }

    return NextResponse.json(
      { repoUrl: body.repoUrl, events, suggestions, total: events.length },
      { status: 200 }
    );
  } catch (err) {
    if (isArcluxError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, filePath: err.filePath },
        { status: statusForErrorCode(err.code) }
      );
    }
    console.error("Unexpected error in /api/diagnostics:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
