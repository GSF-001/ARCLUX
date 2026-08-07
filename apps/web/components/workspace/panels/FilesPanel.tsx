// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { EmptyState } from "@/components/patterns/EmptyState"

/**
 * STATUS: honest placeholder, not a real file browser yet. Deliberately
 * NOT faking a file tree -- there is no dedicated file-listing API route
 * (apps/web/app/api only has analyze/file/graph/impact/search) and no
 * shared file-tree data source in this repo yet.
 *
 * The graph API (packages/graph/*) does contain per-module info that could
 * back a real tree, and vendor-ui/magic-ui/file-tree.tsx exists as a UI
 * primitive, but that component currently fails tsc --noEmit (missing
 * @radix-ui/react-accordion + a not-yet-written scroll-area.tsx -- see
 * PROGRES-status.md's known pre-existing errors). Wiring FilesPanel for
 * real is blocked on one of: (a) fixing file-tree.tsx's missing deps, or
 * (b) building a simpler tree view directly from graph data. Follow-up
 * work, intentionally out of scope here.
 */
export function FilesPanel() {
  return (
    <EmptyState
      title="File browser coming soon"
      message="A real file tree isn't wired up yet -- see FilesPanel.tsx for what's blocking it."
    />
  )
}
