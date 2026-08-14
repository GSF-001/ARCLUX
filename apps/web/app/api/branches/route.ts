// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { getBranches } from "@/packages/git/getBranches";
import { detectDefaultBranch } from "@/packages/git/detectDefaultBranch";

/**
 * GET /api/branches?repoUrl=...
 *
 * Lists a repo's remote branches WITHOUT cloning (git ls-remote) and
 * detects its default branch. Lightweight — unlike the analysis routes,
 * this never clones or indexes. Used by the workspace branch switcher.
 */
export async function GET(request: NextRequest) {
  const repoUrl = request.nextUrl.searchParams.get("repoUrl");

  if (!repoUrl) {
    return NextResponse.json({ error: "`repoUrl` query param is required" }, { status: 400 });
  }

  try {
    const branches = getBranches(repoUrl);
    const defaultBranch = detectDefaultBranch(repoUrl);
    return NextResponse.json({ repoUrl, branches, defaultBranch }, { status: 200 });
  } catch (err) {
    // git ls-remote failures (unreachable repo, bad URL) — caller's repo
    // URL is wrong or the host is unreachable, not the API's fault.
    console.error("Unexpected error in /api/branches:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list branches" },
      { status: 502 }
    );
  }
}
