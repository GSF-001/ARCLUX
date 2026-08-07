// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useEffect, useState } from "react";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { EmptyState } from "@/components/patterns/EmptyState";
import { StatusDot } from "@/components/patterns/StatusDot";

interface AffectedFile {
  moduleId: string;
  filePath: string;
  distance: number;
}

interface ImpactResponse {
  changedModuleId: string;
  notFound: boolean;
  affectedFiles: AffectedFile[];
  totalAffected: number;
  tree: unknown;
}

export interface ImpactSummaryProps {
  repoUrl: string;
  moduleId: string;
  branch?: string;
}

/**
 * Severity (High/Medium/Low) is NOT part of the backend response --
 * packages/impact/* only produces `distance` (BFS hops from the changed
 * module). This mapping is a UI-only heuristic: closer consumers are
 * assumed riskier to break. It has not been validated against real
 * incident data. If this ever needs to reflect actual blast-radius
 * severity (e.g. weighted by fan-in, file size, test coverage), that
 * logic belongs in packages/impact/*, not here.
 */
function severityForDistance(distance: number): { label: string; variant: "error" | "warning" | "info" } {
  if (distance <= 1) return { label: "High", variant: "error" };
  if (distance === 2) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "info" };
}

const INITIAL_VISIBLE = 3;

function ImpactList({ files, emptyMessage }: { files: AffectedFile[]; emptyMessage: string }) {
  const [expanded, setExpanded] = useState(false);

  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const visible = expanded ? files : files.slice(0, INITIAL_VISIBLE);
  const remaining = files.length - visible.length;

  return (
    <div className="space-y-1">
      {visible.map((file) => {
        const severity = severityForDistance(file.distance);
        return (
          <div
            key={file.moduleId}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/30"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.filePath.split("/").pop()}</p>
              <p className="truncate text-xs text-muted-foreground">{file.filePath}</p>
            </div>
            <StatusDot variant={severity.variant} label={severity.label} className="shrink-0" />
          </div>
        );
      })}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="px-2 text-sm text-primary hover:underline"
        >
          {remaining} more
        </button>
      )}
    </div>
  );
}

/**
 * Fetches and renders /api/impact for a given module. Not yet wired into
 * any page (components/explorer/Explorer.tsx is still empty) -- standalone
 * building block, same status as FileDetails.tsx. Not yet visually
 * verified in a browser.
 */
export function ImpactSummary({ repoUrl, moduleId, branch }: ImpactSummaryProps) {
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ repoUrl, moduleId });
        if (branch) params.set("branch", branch);

        const res = await fetch(`/api/impact?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error ?? `Request failed with status ${res.status}`);
        if (!cancelled) setData(json as ImpactResponse);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load impact data");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [repoUrl, moduleId, branch]);

  if (isLoading) return <LoadingState label="Calculating impact..." />;
  if (error) return <ErrorState title="Couldn't calculate impact" message={error} />;
  if (!data || data.notFound) {
    return <EmptyState title="Module not found" message={`"${moduleId}" was not found in this repository's graph.`} />;
  }

  const direct = data.affectedFiles.filter((f) => f.distance === 1);
  const indirect = data.affectedFiles.filter((f) => f.distance > 1);

  return (
    <div className="space-y-6 p-4">
      <div>
        <p className="text-sm text-muted-foreground">Total affected files</p>
        <p className="text-2xl font-semibold">{data.totalAffected}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Direct impact</h3>
          <span className="text-xs text-muted-foreground">{direct.length} files</span>
        </div>
        <ImpactList files={direct} emptyMessage="Nothing directly consumes this module." />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Indirect impact</h3>
          <span className="text-xs text-muted-foreground">{indirect.length} files</span>
        </div>
        <ImpactList files={indirect} emptyMessage="No transitive consumers." />
      </div>
    </div>
  );
}
