import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { isArcluxError } from "@/packages/shared/errors";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const repoUrl = searchParams.get("repoUrl");
  const branch = searchParams.get("branch") ?? undefined;

  if (!repoUrl) {
    return NextResponse.json({ error: "`repoUrl` query param is required" }, { status: 400 });
  }

  try {
    const result = await analyzeRepository({ repoUrl, branch });
    return NextResponse.json(result.graph, { status: 200 });
  } catch (err) {
    if (isArcluxError(err)) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    console.error("Unexpected error in /api/graph:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
