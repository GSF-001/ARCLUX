// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useState } from "react"
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader"
import { WorkspaceCommand } from "@/components/workspace/WorkspaceCommand"
import { FilesPanel } from "@/components/workspace/panels/FilesPanel"
import { ImpactPanel } from "@/components/workspace/panels/ImpactPanel"
import { IssuesPanel } from "@/components/workspace/panels/IssuesPanel"
import { SplitPane } from "@/components/layout/SplitPane"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface WorkspaceProps {
  org: string
  repo: string
  repoUrl: string
  branch?: string
}

/**
 * Composition root for components/workspace/*. Rendered as the `children`
 * of components/layout/WorkspaceLayout.tsx (which owns Navbar/Sidebar/
 * Breadcrumbs) -- this component owns everything BELOW that: the
 * switcher/search header row, the command palette, and the Files/
 * Impact/Issues panel split.
 *
 * NOT yet wired into any app/ route -- app/[org]/[repo]/page.tsx currently
 * just shows a "coming soon" placeholder pointing at /graph. Wiring this
 * in is intentionally left as follow-up work rather than done here, to
 * keep this change reviewable as "the workspace components exist and
 * typecheck" rather than also being "and now the main repo page
 * redesign", which would be a much bigger review surface.
 *
 * FilesPanel and IssuesPanel are honest "coming soon" placeholders (see
 * their own files for why) -- ImpactPanel is the only one backed by real
 * data (ImpactSummary.tsx + /api/impact), so it needs a moduleId, which
 * currently only comes from WorkspaceSearch selection since there's no
 * file tree yet to click into.
 */
export function Workspace({ org, repo, repoUrl, branch }: WorkspaceProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)

  return (
    <div className="flex h-full flex-col">
      <WorkspaceHeader
        org={org}
        repo={repo}
        repoUrl={repoUrl}
        branch={branch}
        onSelectFile={setSelectedModuleId}
      />
      <WorkspaceCommand org={org} repo={repo} />
      <div className="flex-1 overflow-hidden">
        <SplitPane
          left={<FilesPanel />}
          right={
            <Tabs defaultValue="impact" className="flex h-full flex-col">
              <TabsList className="mx-4 mt-2 w-fit">
                <TabsTrigger value="impact">Impact</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
              </TabsList>
              <TabsContent value="impact" className="flex-1 overflow-auto">
                <ImpactPanel repoUrl={repoUrl} moduleId={selectedModuleId} />
              </TabsContent>
              <TabsContent value="issues" className="flex-1 overflow-auto">
                <IssuesPanel repoUrl={repoUrl} branch={branch} />
              </TabsContent>
            </Tabs>
          }
        />
      </div>
    </div>
  )
}
