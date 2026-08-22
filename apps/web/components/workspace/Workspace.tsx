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
import { SecurityPanel } from "@/components/workspace/panels/SecurityPanel"
import { VerifyPanel } from "@/components/workspace/panels/VerifyPanel"
import { HealthPanel } from "@/components/workspace/panels/HealthPanel"
import { CallsPanel } from "@/components/workspace/panels/CallsPanel"
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
 * FilesPanel and IssuesPanel were honest "coming soon" placeholders when
 * this file was written; both are now real (FilesPanel = folderTree from
 * /api/analyze + ProjectStructure, IssuesPanel = /api/doctor findings —
 * see their own headers). ImpactPanel is backed by real data
 * (ImpactSummary.tsx + /api/impact) and needs a moduleId, which comes
 * from WorkspaceSearch OR a click in the FilesPanel tree.
 */
export function Workspace({ org, repo, repoUrl, branch }: WorkspaceProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  // Active branch: defaults to the prop (e.g. from a future URL param),
  // then the branch switcher sets it (which also seeds it from the repo's
  // default via WorkspaceSwitcher). Panels refetch when it changes.
  const [activeBranch, setActiveBranch] = useState<string | undefined>(branch)

  return (
    <div className="flex h-full flex-col">
      <WorkspaceHeader
        org={org}
        repo={repo}
        repoUrl={repoUrl}
        branch={activeBranch}
        onSelectFile={setSelectedModuleId}
        onBranchChange={setActiveBranch}
      />
      <WorkspaceCommand org={org} repo={repo} />
      <div className="flex-1 overflow-hidden">
        <SplitPane
          left={
            <FilesPanel
              repoUrl={repoUrl}
              branch={activeBranch}
              selectedModuleId={selectedModuleId}
              onSelectFile={setSelectedModuleId}
            />
          }
          right={
            <Tabs defaultValue="impact" className="flex h-full flex-col">
              <TabsList className="mx-4 mt-2 w-fit">
                <TabsTrigger value="impact">Impact</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="verify">Verify</TabsTrigger>
                <TabsTrigger value="health">Health</TabsTrigger>
                <TabsTrigger value="calls">Calls</TabsTrigger>
              </TabsList>
              <TabsContent value="impact" className="flex-1 overflow-auto">
                <ImpactPanel repoUrl={repoUrl} moduleId={selectedModuleId} branch={activeBranch} />
              </TabsContent>
              <TabsContent value="issues" className="flex-1 overflow-auto">
                <IssuesPanel repoUrl={repoUrl} branch={activeBranch} />
              </TabsContent>
              <TabsContent value="security" className="flex-1 overflow-auto">
                <SecurityPanel repoUrl={repoUrl} branch={activeBranch} />
              </TabsContent>
              <TabsContent value="verify" className="flex-1 overflow-auto">
                <VerifyPanel repoUrl={repoUrl} branch={activeBranch} />
              </TabsContent>
              <TabsContent value="health" className="flex-1 overflow-auto">
                <HealthPanel repoUrl={repoUrl} branch={activeBranch} />
              </TabsContent>
              <TabsContent value="calls" className="flex-1 overflow-auto">
                <CallsPanel repoUrl={repoUrl} branch={activeBranch} moduleId={selectedModuleId} />
              </TabsContent>
            </Tabs>
          }
        />
      </div>
    </div>
  )
}
