// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { calculateAffectedFiles } from "@/packages/impact/calculateAffectedFiles";
import { buildImpactTree } from "@/packages/impact/buildImpactTree";
import { isArcluxError } from "@/packages/shared/errors";

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

/**
 * GET /api/impact?repoUrl=...&moduleId=...&branch=...
 *
 * moduleId is a module id as it appears in the dependency graph — i.e. a
 * relativePath like "src/utils/format.ts" (see GraphNode.id / ModuleInfo.id
 * in packages/shared/types.ts), not an arbitrary file path.
 *
 * NOTE: like /api/graph, this re-clones and re-indexes the ENTIRE
 * repository on every call — there's no caching yet (packages/cache/* is
 * still unimplemented). Fine for now, but will be slow on large repos or
 * repeated calls. Known limitation, not something to fix in this change.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const repoUrl = searchParams.get("repoUrl");
  const moduleId = searchParams.get("moduleId");
  const branch = searchParams.get("branch") ?? undefined;

  if (!repoUrl) {
    return NextResponse.json({ error: "`repoUrl` query param is required" }, { status: 400 });
  }
  if (!moduleId) {
    return NextResponse.json({ error: "`moduleId` query param is required" }, { status: 400 });
  }

  try {
    const result = await analyzeRepository({ repoUrl, branch });

    const impact = calculateAffectedFiles(result.repository, moduleId);
    if (impact.notFound) {
      return NextResponse.json(
        { error: `Module "${moduleId}" not found in this repository` },
        { status: 404 }
      );
    }

    const tree = buildImpactTree(result.repository, moduleId);

    return NextResponse.json({ ...impact, tree }, { status: 200 });
  } catch (err) {
    if (isArcluxError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, filePath: err.filePath },
        { status: statusForErrorCode(err.code) }
      );
    }
    console.error("Unexpected error in /api/impact:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
