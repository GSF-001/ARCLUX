import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { isAriesError } from "@/packages/shared/errors";

interface AnalyzeRequestBody {
  repoUrl: string;
  branch?: string;
}

/** Maps internal AriesErrorCode to an HTTP status — keeps this mapping in one place */
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
      return 502; // upstream/analysis failure, not the caller's fault
    default:
      return 500;
  }
}

export async function POST(request: NextRequest) {
  let body: AnalyzeRequestBody;
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

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (isAriesError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code, filePath: err.filePath },
        { status: statusForErrorCode(err.code) }
      );
    }

    console.error("Unexpected error in /api/analyze:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
