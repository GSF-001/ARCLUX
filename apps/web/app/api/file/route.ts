// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { parseOrgAndName } from "@/packages/engine/pipeline";
import { detectLanguage } from "@/packages/parser/core/LanguageDetector";
import { highlightPythonSource, type HighlightToken } from "@/packages/parser/python/highlightPython";
import { highlightJavaScriptSource, highlightTypeScriptSource } from "@/packages/parser/javascript/highlightJs";

/**
 * GET /api/file?repoUrl=...&filePath=...&branch=...
 *
 * On-demand file preview: fetches raw source straight from GitHub — NOT
 * from a local clone, since the pipeline deletes the clone right after
 * analysis finishes (see cleanupRepository in packages/engine/pipeline.ts).
 * branch is optional; tries "main" then falls back to "master".
 *
 * Only Python gets syntax highlighting right now. Every other language
 * returns tokens: [] and the client should render it as plain text.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoUrl = searchParams.get("repoUrl");
  const filePath = searchParams.get("filePath");
  const branchParam = searchParams.get("branch");

  if (!repoUrl || !filePath) {
    return NextResponse.json({ error: "`repoUrl` and `filePath` are required" }, { status: 400 });
  }

  let org: string;
  let name: string;
  try {
    ({ org, name } = parseOrgAndName(repoUrl));
  } catch {
    return NextResponse.json({ error: "Could not parse org/repo from repoUrl" }, { status: 400 });
  }

  const branchesToTry = branchParam ? [branchParam] : ["main", "master"];
  let content: string | null = null;
  let usedBranch = "";

  for (const branch of branchesToTry) {
    const rawUrl = `https://raw.githubusercontent.com/${org}/${name}/${branch}/${filePath}`;
    try {
      const res = await fetch(rawUrl);
      if (res.ok) {
        content = await res.text();
        usedBranch = branch;
        break;
      }
    } catch {
      // network error on this branch attempt — try the next one
    }
  }

  if (content === null) {
    return NextResponse.json(
      { error: `Could not fetch "${filePath}" from ${org}/${name} (tried: ${branchesToTry.join(", ")})` },
      { status: 404 }
    );
  }

  const extension = path.extname(filePath);
  const language = detectLanguage(extension);

  let tokens: HighlightToken[] = [];
  try {
    if (language === "python") {
      tokens = await highlightPythonSource(content);
    } else if (language === "javascript") {
      tokens = await highlightJavaScriptSource(content);
    } else if (language === "typescript") {
      tokens = await highlightTypeScriptSource(content);
    }
  } catch (err) {
    // Highlighting is best-effort — fall back to plain text instead of
    // failing the whole request if the query engine errors out.
    console.error(`${language} highlighting failed:`, err);
  }

  return NextResponse.json({ content, language, branch: usedBranch, tokens });
}
