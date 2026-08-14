// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useEffect, useState } from "react";
import { GitCommitHorizontal, Users } from "lucide-react";
import { fetchJson } from "@/lib/api";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { EmptyState } from "@/components/patterns/EmptyState";
import type { CommitInfo } from "@/packages/git/getCommitHistory";
import type { Contributor } from "@/packages/git/getContributors";

export interface ActivityViewProps {
  org: string;
  repo: string;
  repoUrl: string;
  branch?: string;
}

interface HistoryResponse {
  repoUrl: string;
  defaultBranch: string;
  commits: CommitInfo[];
  contributors: Contributor[];
}

function shortHash(hash: string): string {
  return hash.slice(0, 8);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/**
 * [org]/[repo]/activity page: commit history + contributor aggregation
 * from GET /api/history (full clone via cloneRepository({ depth: 0 }) +
 * packages/git getCommitHistory/getContributors — both landed with the
 * git-helpers PR #335).
 */
export function ActivityView({ repoUrl, branch }: ActivityViewProps) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchJson<HistoryResponse>("/api/history", {
          repoUrl,
          branch,
          maxCount: "50",
        });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load commit history");
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

  if (isLoading) return <LoadingState label="Cloning repository history (full clone, may take a moment)..." />;
  if (error || !data) {
    return (
      <ErrorState
        title="Could not load commit history"
        message={error ?? "No data returned from /api/history."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold">Activity</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {data.commits.length} recent commits on {data.defaultBranch} · {data.contributors.length} contributors
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            <GitCommitHorizontal className="h-4 w-4" /> Commit history
          </h2>
          {data.commits.length === 0 ? (
            <EmptyState title="No commits" message="This repository has no commit history." />
          ) : (
            <ul className="space-y-1.5">
              {data.commits.map((commit) => (
                <li
                  key={commit.hash}
                  className="glass-card rounded-md px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <code className="font-mono text-xs text-neutral-500">{shortHash(commit.hash)}</code>
                    <span className="text-xs text-neutral-500">{formatDate(commit.date)}</span>
                    <span className="text-xs text-neutral-500">{commit.authorName}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-neutral-200">{commit.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            <Users className="h-4 w-4" /> Contributors
          </h2>
          {data.contributors.length === 0 ? (
            <EmptyState title="No contributors" message="No author data found." />
          ) : (
            <ul className="space-y-1.5">
              {data.contributors.map((contributor) => (
                <li
                  key={contributor.email}
                  className="glass-card flex items-center justify-between gap-3 rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-200">{contributor.name}</p>
                    <p className="truncate font-mono text-xs text-neutral-500">{contributor.email}</p>
                  </div>
                  <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">
                    {contributor.commits}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
