// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import Link from "next/link";
import { GitFork, Network, Search, Settings } from "lucide-react";

export interface RepositoryHeaderProps {
  org: string;
  repo: string;
  /** e.g. "main" — shown as a small badge when available */
  defaultBranch?: string;
}

/**
 * Overview-page header: repo identity (org/repo) plus quick links to the
 * graph / search / settings views. Pure presentational — data comes from
 * route params + the /api/analyze response via RepositoryOverview.
 */
export function RepositoryHeader({ org, repo, defaultBranch }: RepositoryHeaderProps) {
  const base = `/${org}/${repo}`;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-4">
      <div className="flex min-w-0 items-center gap-2">
        <GitFork className="h-5 w-5 shrink-0 text-neutral-500" />
        <h1 className="truncate font-mono text-lg font-semibold text-neutral-100">
          {org}/{repo}
        </h1>
        {defaultBranch && (
          <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400">
            {defaultBranch}
          </span>
        )}
      </div>

      <nav className="ml-auto flex items-center gap-1 text-sm">
        <Link
          href={base}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
        >
          Overview
        </Link>
        <Link
          href={`${base}/graph`}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
        >
          <Network className="h-4 w-4" />
          Graph
        </Link>
        <Link
          href={`${base}/search`}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
        >
          <Search className="h-4 w-4" />
          Search
        </Link>
        <Link
          href={`${base}/settings`}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </nav>
    </header>
  );
}
