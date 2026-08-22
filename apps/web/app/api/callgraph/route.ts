// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { buildCallGraph } from "@/packages/graph/buildCallGraph";
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

interface CallgraphRequestBody {
  repoUrl: string;
  branch?: string;
  /** Optional module id to focus: returns its callers + callees only. */
  moduleId?: string;
}

/**
 * POST /api/callgraph { repoUrl, branch?, moduleId? }
 *
 * HTTP counterpart of the call graph (buildCallGraph): which file calls
 * which, resolved through named imports. With moduleId: that module's
 * incoming/outgoing call edges. Without: top modules by total call
 * weight. List-shaped data — the interactive canvas already covers
 * visualization elsewhere and stays untouched.
 */
export async function POST(request: NextRequest) {
  let body: CallgraphRequestBody;
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

    const graph = buildCallGraph(result.repository);
    const labelById = new Map(graph.nodes.map((n) => [n.id, n.label]));
    const pathById = new Map(graph.nodes.map((n) => [n.id, n.filePath]));

    const edgeView = (e: (typeof graph.edges)[number]) => ({
      callee: e.target,
      calleeLabel: labelById.get(e.target) ?? e.target,
      caller: e.source,
      callerLabel: labelById.get(e.source) ?? e.source,
      weight: e.weight,
    });

    if (body.moduleId) {
      const outgoing = graph.edges.filter((e) => e.source === body.moduleId).map(edgeView);
      const incoming = graph.edges.filter((e) => e.target === body.moduleId).map(edgeView);
      return NextResponse.json(
        {
          repoUrl: body.repoUrl,
          moduleId: body.moduleId,
          filePath: pathById.get(body.moduleId) ?? null,
          outgoing,
          incoming,
          edgeTotal: graph.edges.length,
        },
        { status: 200 }
      );
    }

    // No focus module: rank modules by total call weight (in + out).
    const weightByModule = new Map<string, number>();
    for (const e of graph.edges) {
      weightByModule.set(e.source, (weightByModule.get(e.source) ?? 0) + (e.weight ?? 0));
      weightByModule.set(e.target, (weightByModule.get(e.target) ?? 0) + (e.weight ?? 0));
    }
    const topModules = [...weightByModule.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, weight]) => ({
        moduleId: id,
        filePath: pathById.get(id) ?? null,
        label: labelById.get(id) ?? id,
        callWeight: weight,
      }));

    return NextResponse.json(
      {
        repoUrl: body.repoUrl,
        nodeCount: graph.nodes.length,
        edgeTotal: graph.edges.length,
        topModules,
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
    console.error("Unexpected error in /api/callgraph:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}