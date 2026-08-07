// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { CommandPalette } from "@/components/patterns/CommandPalette"

export interface WorkspaceCommandProps {
  org: string
  repo: string
}

/**
 * Thin re-export wrapper around the already-built CommandPalette.tsx
 * (Cmd+K / Ctrl+K / "/" global shortcut, see that file for the cmdk
 * attribution). Exists as its own file under components/workspace/ so the
 * workspace composition root (Workspace.tsx) has one clearly-named
 * "command palette lives here" import, matching the naming convention of
 * its sibling files (WorkspaceHeader, WorkspaceSearch, WorkspaceSwitcher)
 * -- not because the underlying behavior differs from CommandPalette.tsx
 * at all.
 */
export function WorkspaceCommand({ org, repo }: WorkspaceCommandProps) {
  return <CommandPalette org={org} repo={repo} />
}
