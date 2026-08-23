// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { AuditWorkspace } from "@/components/script/AuditWorkspace"

interface AuditPageProps {
  params: Promise<{ org: string; repo: string }>
}

/**
 * Standalone audit page — the same experience as the playground's audit
 * mode, but repo context comes from the URL and it renders inside the
 * standard WorkspaceLayout shell (Navbar/Sidebar from the [org]/[repo]
 * layout apply automatically).
 */
export default async function AuditPage({ params }: AuditPageProps) {
  const { org, repo } = await params

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <AuditWorkspace initialRepoUrl={`https://github.com/${org}/${repo}`} />
    </div>
  )
}