// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/packages/engine/pipeline";
import { detectCircularDependency } from "@/packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "@/packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "@/packages/detectors/detectOrphanFiles";
import { detectLargeModules } from "@/packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "@/packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "@/packages/detectors/detectSharedModules";
import { detectIndexFiles } from "@/packages/detectors/detectIndexFiles";
import { detectLayerViolation } from "@/packages/detectors/detectLayerViolation";
import { detectDeadCode } from "@/packages/detectors/detectDeadCode";
import { detectAmbiguousSymbolResolution } from "@/packages/detectors/detectAmbiguousSymbolResolution";
import { runRules } from "@/packages/rules/RuleEngine";
import { requirePage } from "@/packages/rules/nextjs/requirePage";
import { requireRoute } from "@/packages/rules/nextjs/requireRoute";
import { requireIndexUpdate } from "@/packages/rules/nextjs/requireIndexUpdate";
import { requireLayoutUpdate } from "@/packages/rules/nextjs/requireLayoutUpdate";
import { requireMetadata } from "@/packages/rules/nextjs/requireMetadata";
import { requireControllerBinding } from "@/packages/rules/nestjs/requireControllerBinding";
import { requireModuleRegistration } from "@/packages/rules/nestjs/requireModuleRegistration";
import { requireRouteRegistration } from "@/packages/rules/express/requireRouteRegistration";
import { requireEntryConfig } from "@/packages/rules/vite/requireEntryConfig";
import { requireMainProcessBinding } from "@/packages/rules/electron/requireMainProcessBinding";
import { requirePreloadExposure } from "@/packages/rules/electron/requirePreloadExposure";
import { requireComponentExport } from "@/packages/rules/react/requireComponentExport";
import { requireHookRules } from "@/packages/rules/react/requireHookRules";
import { requireController } from "@/packages/rules/laravel/requireController";
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

interface VerifyRequestBody {
  repoUrl: string;
  branch?: string;
}

/**
 * POST /api/verify { repoUrl, branch? }
 *
 * HTTP counterpart of `arclux verify`: 10 pass/fail detectors + all 14
 * implemented framework rules (framework filtering happens inside
 * runRules via detectedFrameworks). Returns a single verdict — FAIL when
 * any detector finding or any rule error exists; rule warnings alone
 * don't fail (same semantics as the CLI).
 */
export async function POST(request: NextRequest) {
  let body: VerifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.repoUrl || typeof body.repoUrl !== "string") {
    return NextResponse.json({ error: "`repoUrl` is required" }, { status: 400 });
  }

  try {
    const { repository, meta } = await analyzeRepository({
      repoUrl: body.repoUrl,
      branch: body.branch,
    });

    const checks = {
      circularDependency: detectCircularDependency(repository),
      unusedExports: detectUnusedExports(repository),
      orphanFiles: detectOrphanFiles(repository),
      largeModules: detectLargeModules(repository),
      duplicateModules: detectDuplicateModules(repository),
      sharedModules: detectSharedModules(repository),
      indexFiles: detectIndexFiles(repository),
      layerViolation: detectLayerViolation(repository),
      deadCode: detectDeadCode(repository),
      ambiguousSymbolResolution: detectAmbiguousSymbolResolution(repository),
    };

    const detectorTotal = Object.values(checks).reduce((sum, f) => sum + f.length, 0);

    const ruleViolations = runRules(
      repository,
      [
        requirePage,
        requireRoute,
        requireIndexUpdate,
        requireLayoutUpdate,
        requireMetadata,
        requireControllerBinding,
        requireModuleRegistration,
        requireRouteRegistration,
        requireEntryConfig,
        requireMainProcessBinding,
        requirePreloadExposure,
        requireComponentExport,
        requireHookRules,
        requireController,
      ],
      meta.detectedFrameworks
    );

    const ruleErrors = ruleViolations.filter((v) => v.severity === "error");
    const ruleWarnings = ruleViolations.filter((v) => v.severity === "warning");

    return NextResponse.json(
      {
        repoUrl: body.repoUrl,
        frameworksChecked: meta.detectedFrameworks,
        detectorTotal,
        checks,
        rules: {
          violations: ruleViolations,
          errors: ruleErrors.length,
          warnings: ruleWarnings.length,
        },
        verdict: detectorTotal > 0 || ruleErrors.length > 0 ? "FAIL" : "PASS",
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
    console.error("Unexpected error in /api/verify:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}