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
import { RepositoryHeader } from "./RepositoryHeader";
import { RepositoryInfo } from "./RepositoryInfo";
import { ProjectStructure } from "./ProjectStructure";
import { Explorer } from "@/components/explorer/Explorer";
import type { FileTreeNode } from "@/packages/graph/buildFolderGraph";
import type { DependencyGraph } from "@/packages/shared/types";

export interface RepositoryOverviewProps {
  org: string;
  repo: string;
  branch?: string;
}

interface AnalyzeResponse {
  meta: {
    id: string;
    org: string;
    name: string;
    defaultBranch: string;
    detectedFrameworks: string[];
    packageManager: string;
    analyzedAt: string;
  };
  moduleCount: number;
  graph: DependencyGraph;
  dependencies: unknown[];
  folderTree: FileTreeNode;
}

/**
 * The [org]/[repo] overview page: header, stat strip, and an interactive
 * file tree of the analyzed repository. Fetches POST /api/analyze (full
 * clone + index + folder tree — same no-cache cost as the graph page's
 * GET /api/graph; see the route's own comment).
 *
 * The folder tree is computed SERVER-side by the route (buildFolderGraph
 * needs the Repository, which never leaves the server) and arrives as a
 * serializable FileTreeNode.
 */
export function RepositoryOverview({ org, repo, branch }: RepositoryOverviewProps) {
  const repoUrl = `https://github.com/${org}/${repo}.git`;
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await postJson<AnalyzeResponse>("/api/analyze", {
          repoUrl,
          branch,
        });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to analyze repository");
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

  if (isLoading) return <LoadingState label={`Analyzing ${org}/${repo}...`} />;
  if (error || !data) {
    return (
      <ErrorState
        title="Could not analyze this repository"
        message={error ?? "No data returned from /api/analyze."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <RepositoryHeader
        org={data.meta.org}
        repo={data.meta.name}
        defaultBranch={data.meta.defaultBranch}
      />
      <div className="flex-1 overflow-auto p-6">
        <RepositoryInfo
          moduleCount={data.moduleCount}
          nodeCount={data.graph.nodes.length}
          edgeCount={data.graph.edges.length}
          frameworks={data.meta.detectedFrameworks}
          packageManager={data.meta.packageManager}
          dependencyCount={data.dependencies.length}
          analyzedAt={data.meta.analyzedAt}
        />

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Project structure
          </h2>
          <div className="flex gap-4">
            <div className="max-h-[60vh] flex-1 overflow-auto rounded-lg bg-neutral-950/60 p-3">
              <ProjectStructure
                tree={data.folderTree}
                selectedPath={selectedPath}
                onSelectFile={setSelectedPath}
              />
            </div>
            {selectedPath && (
              <div className="max-h-[60vh] w-[45%] shrink-0 overflow-hidden rounded-lg bg-neutral-950/60">
                <Explorer
                  repoUrl={repoUrl}
                  moduleId={selectedPath}
                  branch={branch}
                  onClose={() => setSelectedPath(null)}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
