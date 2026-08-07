// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Addresses the "no progress feedback during analysis" gap flagged in
// PROGRES-status.md. IMPORTANT — this is NOT real progress. The pipeline
// runs synchronously server-side with no intermediate events streamed to
// the client. This shows cycling stage labels + an indeterminate bar to
// communicate "still happening", not a measurement of actual progress.
// A real fix needs the backend to stream stage events (e.g. SSE) — not
// done here, this is a stopgap for the UX gap only.

"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Cloning repository…",
  "Scanning files…",
  "Parsing source…",
  "Resolving imports…",
  "Building dependency graph…",
] as const;

const STAGE_DURATION_MS = 2500;

export function AnalyzingProgress() {
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs((prev) => prev + 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const nextIndex = Math.min(STAGES.length - 1, Math.floor(elapsedMs / STAGE_DURATION_MS));
    setStageIndex(nextIndex);
  }, [elapsedMs]);

  const isTakingAWhile = elapsedMs > STAGES.length * STAGE_DURATION_MS + 5000;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-sm text-neutral-500">
      <div className="w-64">
        <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full animate-pulse rounded-full bg-blue-500 transition-all duration-500"
            style={{
              width: `${Math.min(95, ((stageIndex + 1) / STAGES.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      <p>{STAGES[stageIndex]}</p>

      {isTakingAWhile && (
        <p className="max-w-xs text-center text-xs text-neutral-600">
          This is taking longer than usual — large repositories can take
          several minutes to clone and parse, especially on slower devices.
        </p>
      )}
    </div>
  );
}
