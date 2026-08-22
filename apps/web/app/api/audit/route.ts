// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { runDoctor } from "@/packages/engine/runDoctor";
import { computeHealthScore, DOCTOR_CATEGORIES } from "@/packages/engine/healthScore";
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

interface AuditRequestBody {
  repoUrl: string;
  branch?: string;
}

/**
 * POST /api/audit { repoUrl, branch? }
 *
 * Composes three EXISTING sources — zero new detectors:
 *   1. runDoctor()                     → structural/convention findings
 *   2. result.securityAnalysis          → secrets/unsafe/dangerous APIs
 *      (computed in-pipeline while the clone exists — same as /api/security;
 *       calling analyzeRepositorySecurity() again post-cleanup would fail
 *       for remote repos)
 *   3. mapAttackSurface(repo, graph)   → entry/reachable/unreachable counts
 *
 * Findings are grouped into narrative chapters (security severity first,
 * then doctor categories via DOCTOR_CATEGORIES) and every item keeps its
 * original fields — messages from detectOrphanIntegration etc. are shown
 * verbatim downstream, never rewritten here.
 */
export async function POST(request: NextRequest) {
  let body: AuditRequestBody;
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

    const doctor = runDoctor(result.repository);
    const health = computeHealthScore(doctor.findings, result.moduleCount);
    const attackSurface = mapAttackSurface(result.repository, result.graph);
    const security = result.securityAnalysis;

    const SECURITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const DOCTOR_ORDER = { error: 0, warning: 1, info: 2 } as const;

    type AuditItem = Record<string, unknown> & {
      source: "doctor" | "security";
    };

    const chapters: {
      id: string;
      label: string;
      kind: "security" | "doctor";
      count: number;
      items: AuditItem[];
    }[] = [];

    if (security) {
      const bySeverity = (sevs: ("critical" | "high" | "medium" | "low")[]) =>
        security.findings
          .filter((f) => sevs.includes(f.severity))
          .sort((a, b) => SECURITY_ORDER[a.severity] - SECURITY_ORDER[b.severity])
          .map((f) => ({ ...f, source: "security" as const }));

      const critical = bySeverity(["critical", "high"]);
      if (critical.length > 0) {
        chapters.push({ id: "threats", label: "Ancaman keamanan", kind: "security", count: critical.length, items: critical });
      }
      const minor = bySeverity(["medium", "low"]);
      if (minor.length > 0) {
        chapters.push({ id: "hygieneSecurity", label: "Catatan keamanan", kind: "security", count: minor.length, items: minor });
      }
    }

    for (const cat of DOCTOR_CATEGORIES) {
      const items = doctor.findings
        .filter((f) => cat.checkIds.includes(f.checkId))
        .sort((a, b) => DOCTOR_ORDER[a.severity] - DOCTOR_ORDER[b.severity])
        .map((f) => ({ ...f, source: "doctor" as const }));
      if (items.length > 0) {
        chapters.push({ id: cat.id, label: cat.label, kind: "doctor", count: items.length, items });
      }
    }

    return NextResponse.json(
      {
        repoUrl: body.repoUrl,
        moduleCount: result.moduleCount,
        findingTotal: doctor.findings.length + (security?.findings.length ?? 0),
        overallHealth: health.overall,
        categories: health.categories,
        attackSurface: {
          entryPoints: attackSurface.entryPoints.length,
          reachableModules: attackSurface.reachableModules.length,
          unreachableModules: attackSurface.unreachableModules.length,
        },
        chapters,
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
    console.error("Unexpected error in /api/audit:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}