// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { cloneRepository } from "@/packages/git/cloneRepository";
import { cleanupRepository } from "@/packages/git/cleanupRepository";
import { getCommitHistory, type CommitInfo } from "@/packages/git/getCommitHistory";
import { getContributors, type Contributor } from "@/packages/git/getContributors";
import { isArcluxError } from "@/packages/shared/errors";

/**
 * GET /api/history?repoUrl=...&maxCount=50&branch=...
 *
 * Commit history + contributor aggregation for a repo. Unlike the
 * analysis routes this needs git LOG data, so it does a FULL clone
 * (cloneRepository depth: 0 — no --depth flag), reads history, then
 * cleans up. Full clone is slower than a shallow one; maxCount caps the
 * returned commits (default 50).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const repoUrl = searchParams.get("repoUrl");
  const branch = searchParams.get("branch") ?? undefined;
  const rawMaxCount = searchParams.get("maxCount");
  const maxCount = rawMaxCount ? Math.max(1, Math.min(100, Number(rawMaxCount) || 50)) : 50;

  if (!repoUrl) {
    return NextResponse.json({ error: "`repoUrl` query param is required" }, { status: 400 });
  }

  let localPath: string | undefined;
  try {
    const cloneResult = await cloneRepository({ repoUrl, branch, depth: 0 });
    localPath = cloneResult.localPath;

    const commits: CommitInfo[] = await getCommitHistory(localPath, { maxCount, branch });
    const contributors: Contributor[] = await getContributors(localPath);

    return NextResponse.json(
      { repoUrl, defaultBranch: cloneResult.branch, commits, contributors },
      { status: 200 }
    );
  } catch (err) {
    if (isArcluxError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, filePath: err.filePath },
        { status: 502 }
      );
    }
    console.error("Unexpected error in /api/history:", err);
    return NextResponse.json({ error: "Failed to load commit history" }, { status: 502 });
  } finally {
    if (localPath) {
      await cleanupRepository(localPath).catch(() => {
        // best-effort cleanup — never mask the real error
      });
    }
  }
}
