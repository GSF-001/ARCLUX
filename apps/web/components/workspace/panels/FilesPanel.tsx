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
import { ProjectStructure } from "@/components/overview/ProjectStructure";
import type { FileTreeNode } from "@/packages/graph/buildFolderGraph";

export interface FilesPanelProps {
  repoUrl: string;
  branch?: string;
  /** Currently selected module id — highlighted in the tree. */
  selectedModuleId?: string | null;
  /** Called with the selected file's path (= moduleId) when a file is clicked. */
  onSelectFile?: (moduleId: string) => void;
}

interface AnalyzeResponse {
  folderTree: FileTreeNode;
}

/**
 * Workspace Files tab: an interactive file tree of the analyzed repo.
 *
 * The tree comes from POST /api/analyze's server-side `folderTree`
 * (buildFolderGraph — added in #330; it needs the Repository, which never
 * leaves the server). This replaced the old "blocked on a file-listing
 * API" placeholder — the folderTree IS that data source. Cost note: this
 * triggers a full clone+index per call, same as the other workspace
 * panels (no caching yet — see /api/analyze's comment).
 *
 * Selection is lifted to the parent (Workspace.tsx's selectedModuleId,
 * shared with ImpactPanel via WorkspaceSearch) — clicking a file here
 * also drives the Impact tab.
 */
export function FilesPanel({ repoUrl, branch, selectedModuleId, onSelectFile }: FilesPanelProps) {
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await postJson<AnalyzeResponse>("/api/analyze", { repoUrl, branch });
        if (!cancelled) setTree(result.folderTree);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file tree");
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

  if (isLoading) return <LoadingState label="Loading file tree..." />;
  if (error || !tree) {
    return (
      <ErrorState
        title="Could not load file tree"
        message={error ?? "No folderTree returned from /api/analyze."}
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-3">
      <ProjectStructure
        tree={tree}
        selectedPath={selectedModuleId}
        onSelectFile={onSelectFile}
      />
    </div>
  );
}
