// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { ImpactSummary } from "@/components/explorer/ImpactSummary"
import { EmptyState } from "@/components/patterns/EmptyState"

export interface ImpactPanelProps {
  repoUrl: string
  /** Selected module id (relativePath in the graph), e.g. "src/utils/format.ts". */
  moduleId: string | null
}

/**
 * Thin wrapper around ImpactSummary.tsx (already built and browser-verified,
 * see PROGRES-status.md) for the workspace layout. Requires a moduleId --
 * the workspace's file selection state (WorkspaceSwitcher / FilesPanel) is
 * expected to feed this. Not yet wired to a real file-selection flow, since
 * FilesPanel.tsx is still a "coming soon" placeholder -- see its own file.
 */
export function ImpactPanel({ repoUrl, moduleId }: ImpactPanelProps) {
  if (!moduleId) {
    return (
      <EmptyState
        title="No file selected"
        message="Select a file to see what depends on it and what it would break."
      />
    )
  }

  return <ImpactSummary repoUrl={repoUrl} moduleId={moduleId} />
}
