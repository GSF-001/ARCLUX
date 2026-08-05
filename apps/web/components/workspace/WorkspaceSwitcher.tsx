// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import Link from "next/link"
import { ChevronsUpDown, GitBranch } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface WorkspaceSwitcherProps {
  org: string
  repo: string
  branch?: string
  /** Other repos previously analyzed in this session/browser, for quick switching. */
  recentRepos?: { org: string; repo: string }[]
}

/**
 * Repo/branch switcher for the workspace header. Concept (dropdown listing
 * known options, current selection shown as the trigger label) inspired by
 * git-truck's RevisionSelect.tsx (MIT) -- not a port, that component is a
 * native <select> wired to react-router loader data specific to git-truck's
 * own server-rendered branch list, which has no equivalent here yet.
 *
 * Branch switching is NOT functional yet -- ARCLUX's pipeline
 * (packages/engine/pipeline.ts) accepts a branch param, but no route
 * currently lets the user pick one in the UI. This only switches between
 * recently-analyzed repos for now.
 */
export function WorkspaceSwitcher({ org, repo, branch, recentRepos = [] }: WorkspaceSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 font-mono text-sm" />
        }
      >
        <span className="max-w-[200px] truncate">
          {org}/{repo}
        </span>
        {branch && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {branch}
          </span>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Current repository</DropdownMenuLabel>
        <DropdownMenuItem disabled className="font-mono text-xs">
          {org}/{repo}
        </DropdownMenuItem>
        {recentRepos.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recentRepos.map((r) => (
              <DropdownMenuItem
                key={`${r.org}/${r.repo}`}
                render={<Link href={`/${r.org}/${r.repo}`} />}
                className="font-mono text-xs"
              >
                {r.org}/{r.repo}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/new" />}>
          Analyze another repository
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
