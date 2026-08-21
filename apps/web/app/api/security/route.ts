// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { mapAttackSurface } from "@/packages/correlation/AttackSurfaceMapper";
import { isArcluxError } from "@/packages/shared/errors";

/** Maps internal ArcluxErrorCode to an HTTP status — mirrors /api/analyze */
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

interface SecurityRequestBody {
  repoUrl: string;
  branch?: string;
}

/**
 * POST /api/security { repoUrl, branch? }
 *
 * HTTP counterpart of `arclux security`. Returns the source-level
 * security analysis (legacy secrets, unsafe patterns, dangerous APIs —
 * computed inside the pipeline while the clone still exists) plus the
 * attack-surface map derived from the dependency graph.
 *
 * Note: trust-boundary/cross-boundary/dependency-risk detectors from the
 * CLI's richer pipeline are not re-run here yet — they need file sources
 * which are gone after the temp clone cleanup. Follow-up: carry those
 * results through AnalyzeRepositoryResult like securityAnalysis already
 * is.
 */
export async function POST(request: NextRequest) {
  let body: SecurityRequestBody;
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

    const attackSurface = mapAttackSurface(result.repository, result.graph);
    const analysis = result.securityAnalysis;
    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis did not include a security report" },
        { status: 500 }
      );
    }

    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of analysis.findings) {
      const sev = (f.severity ?? "info").toLowerCase();
      if (sev in counts) counts[sev as keyof typeof counts]++;
    }

    return NextResponse.json(
      {
        repoUrl: body.repoUrl,
        target: analysis.target,
        analyzedAt: analysis.analyzedAt,
        summary: {
          total: analysis.findings.length,
          ...counts,
          entryPoints: attackSurface.entryPoints.length,
          reachableModules: attackSurface.reachableModules.length,
          unreachableModules: attackSurface.unreachableModules.length,
        },
        findings: analysis.findings,
        attackSurface,
      },
      { status: 200 }
    );
  } catch (err) {
    if (isArcluxError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, filePath: err.filePath },
        { status: statusForErrorCode(err.code) }
      );
    }
    console.error("Unexpected error in /api/security:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}