// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { buildSearchIndex } from "@/packages/search/SearchIndex";
import { search } from "@/packages/search/SearchEngine";
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
 * Real search implementation (issue #9): builds a SearchIndex from the
 * analyzed repository and ranks modules with packages/search/SearchEngine
 * (fuzzyScore over file path + file name + export names). Replaces the
 * previous stopgap that ran an inline fuzzy-score loop over file paths
 * only.
 *
 * The response shape is unchanged and backward-compatible:
 * { query, results: [{ moduleId, filePath, score }] }. The engine's extra
 * per-result fields (language, matches) are deliberately stripped here so
 * consumers (GlobalSearch.tsx, WorkspaceSearch.tsx) keep working untouched.
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

    const index = buildSearchIndex(result.repository);
    const ranked = search(index, query, { limit: MAX_RESULTS });
    const results = ranked.map((r) => ({
      moduleId: r.moduleId,
      filePath: r.filePath,
      score: r.score,
    }));

    return NextResponse.json({ query, results }, { status: 200 });
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
