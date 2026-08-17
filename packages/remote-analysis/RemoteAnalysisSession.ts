// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { RemoteAnalysisResult } from "./RemoteAnalysisResult";
import type { RemoteSource } from "../remote/RemoteSource";

export type RemoteAnalysisStatus = "pending" | "running" | "completed" | "failed";

export interface RemoteAnalysisSession {
  id: string;
  source?: RemoteSource | string;
  status: RemoteAnalysisStatus;
  startedAt: string;
  completedAt?: string;
  result?: RemoteAnalysisResult;
  error?: string;
  metadata?: Record<string, unknown>;
}

export function createRemoteAnalysisSession(source?: RemoteSource | string): RemoteAnalysisSession {
  return {
    id: crypto.randomUUID(),
    source,
    status: "pending",
    startedAt: new Date().toISOString(),
  };
}

export function updateRemoteAnalysisSession(
  session: RemoteAnalysisSession,
  update: Pick<RemoteAnalysisSession, "status"> & Partial<RemoteAnalysisSession>,
): RemoteAnalysisSession {
  return { ...session, ...update };
}
