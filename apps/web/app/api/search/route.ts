// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { fuzzyScore } from "@/packages/search/fuzzyScore";
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

const MAX_RESULTS = 50;

/**
 * GET /api/search?repoUrl=...&q=...&branch=...
 *
 * Searches module file paths using packages/search/fuzzyScore.ts (adapted
 * from cmdk). This is a stopgap, not the "real" search implementation —
 * packages/search/SearchEngine.ts, SearchIndex.ts etc. are still
 * unimplemented (0%). This only searches file paths, not file contents,
 * export names, or anything else an eventual SearchEngine would index.
 *
 * Same caching caveat as /api/impact: full re-clone + re-index every call.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const repoUrl = searchParams.get("repoUrl");
  const query = searchParams.get("q");
  const branch = searchParams.get("branch") ?? undefined;

  if (!repoUrl) {
    return NextResponse.json({ error: "`repoUrl` query param is required" }, { status: 400 });
  }
  if (!query) {
    return NextResponse.json({ error: "`q` query param is required" }, { status: 400 });
  }

  try {
    const result = await analyzeRepository({ repoUrl, branch });

    const scored = result.repository
      .getAllModules()
      .map((module) => ({
        moduleId: module.id,
        filePath: module.file.relativePath,
        score: fuzzyScore(module.file.relativePath, query),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);

    return NextResponse.json({ query, results: scored }, { status: 200 });
  } catch (err) {
    if (isArcluxError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, filePath: err.filePath },
        { status: statusForErrorCode(err.code) }
      );
    }
    console.error("Unexpected error in /api/search:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
