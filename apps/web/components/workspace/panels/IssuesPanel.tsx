// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { EmptyState } from "@/components/patterns/EmptyState";
import type { DoctorFinding, DoctorSeverity } from "@/packages/engine/runDoctor";

export interface IssuesPanelProps {
  repoUrl: string;
  branch?: string;
}

interface DoctorResponse {
  repoUrl: string;
  findings: DoctorFinding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

const SEVERITY_STYLE: Record<DoctorSeverity, string> = {
  error: "bg-red-500",
  warning: "bg-yellow-500",
  info: "bg-neutral-500",
};

const SEVERITY_LABEL: Record<DoctorSeverity, string> = {
  error: "error",
  warning: "warning",
  info: "info",
};

function FindingRow({ finding }: { finding: DoctorFinding }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_STYLE[finding.severity]}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <code className="text-xs text-neutral-400">{finding.checkId}</code>
          <span className="text-[10px] uppercase tracking-wide text-neutral-600">
            {SEVERITY_LABEL[finding.severity]}
          </span>
          {finding.filePath && (
            <code className="truncate font-mono text-xs text-neutral-300">{finding.filePath}</code>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-400">{finding.message}</p>
      </div>
    </li>
  );
}

/**
 * Workspace Issues tab: renders detector findings from POST /api/doctor
 * (packages/engine/runDoctor.ts — the 19-detector suite normalized to one
 * flat list), grouped error → warning → info. Replaces the honest
 * "no issues panel yet" placeholder; see that file's old comment for the
 * reasoning that led here.
 */
export function IssuesPanel({ repoUrl, branch }: IssuesPanelProps) {
  const [data, setData] = useState<DoctorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await postJson<DoctorResponse>("/api/doctor", { repoUrl, branch });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to run detector suite");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [repoUrl, branch, retryCount]);

  if (isLoading) return <LoadingState label="Running detectors..." />;
  if (error || !data) {
    return (
      <ErrorState
        title="Could not run detectors"
        message={error ?? "No data returned from /api/doctor."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    );
  }

  const bySeverity = (severity: DoctorSeverity) =>
    data.findings.filter((finding) => finding.severity === severity);

  if (data.findings.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No issues found"
          message="The detector suite ran clean against this repository."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2.5 text-sm">
        <span className="font-medium text-red-400">{data.errorCount} errors</span>
        <span className="text-yellow-400">{data.warningCount} warnings</span>
        <span className="text-neutral-500">{data.infoCount} info</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {(["error", "warning", "info"] as const).map((severity) => {
          const findings = bySeverity(severity);
          if (findings.length === 0) return null;
          return (
            <section key={severity}>
              <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {SEVERITY_LABEL[severity]} ({findings.length})
              </h3>
              <ul className="space-y-1.5">
                {findings.map((finding, index) => (
                  <FindingRow key={`${finding.checkId}-${index}`} finding={finding} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
