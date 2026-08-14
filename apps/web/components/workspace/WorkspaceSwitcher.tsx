// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronsUpDown, GitBranch, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { fetchJson } from "@/lib/api"
import { cn } from "@/lib/cn"

export interface WorkspaceSwitcherProps {
  org: string
  repo: string
  branch?: string
  /** Called when the user picks a branch from the dropdown. */
  onBranchChange?: (branch: string) => void
  /** Other repos previously analyzed in this session/browser, for quick switching. */
  recentRepos?: { org: string; repo: string }[]
}

interface BranchesResponse {
  branches: string[]
  defaultBranch: string | null
}

/**
 * Repo/branch switcher for the workspace header. Concept (dropdown listing
 * known options, current selection shown as the trigger label) inspired by
 * git-truck's RevisionSelect.tsx (MIT) -- not a port.
 *
 * Branch list comes from GET /api/branches (git ls-remote --heads, no
 * clone — packages/git/getBranches.ts + detectDefaultBranch.ts, both were
 * stubs). Selecting a branch calls onBranchChange; the parent
 * (Workspace.tsx) owns the active branch and refetches the panels with it.
 */
export function WorkspaceSwitcher({ org, repo, branch, onBranchChange, recentRepos = [] }: WorkspaceSwitcherProps) {
  const repoUrl = `https://github.com/${org}/${repo}.git`
  const [branches, setBranches] = useState<string[]>([])
  const [branchesLoaded, setBranchesLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchJson<BranchesResponse>("/api/branches", { repoUrl })
      .then((data) => {
        if (cancelled) return
        setBranches(data.branches)
        // If no branch is active yet, fall back to the repo's default.
        if (!branch && data.defaultBranch) onBranchChange?.(data.defaultBranch)
      })
      .catch(() => {
        // Silent: a failed branch listing just means the branch section
        // stays hidden — the repo switcher still works.
      })
      .finally(() => {
        if (!cancelled) setBranchesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [repoUrl]) // eslint-disable-line react-hooks/exhaustive-deps -- onBranchChange is a stable setState from the parent

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

        {branchesLoaded && branches.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Branches</DropdownMenuLabel>
            <div className="max-h-48 overflow-y-auto">
              {branches.map((name) => (
                <DropdownMenuItem
                  key={name}
                  onSelect={() => onBranchChange?.(name)}
                  className={cn("font-mono text-xs", name === branch && "text-primary")}
                >
                  <span className="truncate">{name}</span>
                  {name === branch && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
