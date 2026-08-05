// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher"
import { WorkspaceSearch } from "@/components/workspace/WorkspaceSearch"

export interface WorkspaceHeaderProps {
  org: string
  repo: string
  repoUrl: string
  branch?: string
  onSelectFile?: (moduleId: string) => void
}

/**
 * Row combining WorkspaceSwitcher (left) + WorkspaceSearch (right).
 * Rendered inside Workspace.tsx above the panel area -- NOT a replacement
 * for components/layout/WorkspaceLayout.tsx's Navbar/Sidebar/Breadcrumbs
 * shell, which stays outside this. This is workspace-internal chrome
 * only (repo switcher + file search), one level down from the page shell.
 */
export function WorkspaceHeader({ org, repo, repoUrl, branch, onSelectFile }: WorkspaceHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-2">
      <WorkspaceSwitcher org={org} repo={repo} branch={branch} />
      <WorkspaceSearch repoUrl={repoUrl} branch={branch} onSelect={onSelectFile} />
    </div>
  )
}
