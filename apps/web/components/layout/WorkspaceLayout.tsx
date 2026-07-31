// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/Breadcrumbs"

interface WorkspaceLayoutProps {
  org: string
  repo: string
  breadcrumbs: BreadcrumbItem[]
  children: React.ReactNode
}

export function WorkspaceLayout({ org, repo, breadcrumbs, children }: WorkspaceLayoutProps) {
  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar org={org} repo={repo} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b px-6 py-3">
            <Breadcrumbs items={breadcrumbs} />
          </div>
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}
