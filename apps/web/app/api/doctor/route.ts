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

interface DoctorRequestBody {
  repoUrl: string;
  branch?: string;
}

/**
 * POST /api/doctor { repoUrl, branch? }
 *
 * Runs the full 19-detector suite server-side (packages/engine/runDoctor.ts
 * — the HTTP counterpart of `arclux doctor`) and returns the findings
 * normalized to { checkId, severity, filePath?, message } plus severity
 * counts. Same no-cache cost as /api/analyze: full clone + index per call.
 */
export async function POST(request: NextRequest) {
  let body: DoctorRequestBody;
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

    return NextResponse.json({ repoUrl: body.repoUrl, ...doctor }, { status: 200 });
  } catch (err) {
    if (isArcluxError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, filePath: err.filePath },
        { status: statusForErrorCode(err.code) }
      );
    }
    console.error("Unexpected error in /api/doctor:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
