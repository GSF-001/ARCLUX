// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { AnalyzeRepositoryResult } from "../engine/pipeline";
import type { SecurityAnalysis } from "../security-analysis/SecurityAnalysis";
import type { RemoteAnalysisRequest } from "./RemoteAnalysisRequest";

export interface RemoteAnalysisResult {
  id: string;
  source?: RemoteAnalysisRequest["source"];
  ok: boolean;
  startedAt: string;
  completedAt: string;
  analysis?: AnalyzeRepositoryResult;
  security?: SecurityAnalysis;
  error?: string;
  metadata?: Record<string, unknown>;
}

export function createRemoteAnalysisResult(
  source?: RemoteAnalysisRequest["source"],
  values: Partial<Omit<RemoteAnalysisResult, "id" | "source">> = {},
): RemoteAnalysisResult {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    source,
    ok: values.ok ?? false,
    startedAt: values.startedAt ?? now,
    completedAt: values.completedAt ?? now,
    ...values,
  };
}
