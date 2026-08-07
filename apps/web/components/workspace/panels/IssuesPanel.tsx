// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { EmptyState } from "@/components/patterns/EmptyState"

/**
 * STATUS: honest placeholder, not real data. Deliberately NOT faking
 * detector findings here -- there is no /api/issues or /api/doctor route
 * (apps/web/app/api only has analyze/file/graph/impact/search). The
 * detector logic itself is complete (packages/detectors/*, 18/18, see
 * PROGRES-status.md) and already runs via `apps/cli doctor`, but nothing
 * exposes it over HTTP for the web UI yet. Follow-up work: add an
 * /api/doctor route that runs the detector suite server-side and returns
 * findings[], then wire this panel to render them (grouped by severity,
 * similar to ImpactSummary's severity badges).
 */
export function IssuesPanel() {
  return (
    <EmptyState
      title="No issues panel yet"
      message="Detector findings aren't exposed over the API yet -- see IssuesPanel.tsx for what's needed."
    />
  )
}
