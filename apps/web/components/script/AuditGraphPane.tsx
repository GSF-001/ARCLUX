// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useEffect, useMemo, useRef } from "react"
import { GraphCanvas3D } from "@/components/graph/GraphCanvas3D"
import { GraphProvider, useGraphContext } from "@/components/graph/GraphProvider"

/** Narrow ForceGraph3D surface for camera flights — same cast pattern as
 * GraphMenu.tsx (see its doc comment for why controls().target anchors). */
interface CameraControls {
  cameraPosition(
    position?: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number } | null,
    transitionMs?: number
  ): unknown;
  graphData(): { nodes: { id: string; x?: number; y?: number; z?: number }[] };
}

export interface AuditFocusTarget {
  /** Primary file under the cursor of the audit walkthrough. */
  filePath: string | null
  /** For circularDependency findings: every file in the parsed cycle. */
  cycleFiles: string[]
}

interface AuditGraphPaneProps {
  repoUrl: string
  branch?: string
  target: AuditFocusTarget | null
}

/**
 * Isolated 3D canvas instance for the audit walkthrough. Composition
 * only: GraphProvider + GraphCanvas3D exactly as GraphViewport wires
 * them — zero changes to core rendering. Selection highlight comes free
 * via the provider's selectNode (white ring + glow in GraphNode/Canvas3D),
 * and camera flights use the same library API GraphMenu already drives.
 */
export function AuditGraphPane({ repoUrl, branch, target }: AuditGraphPaneProps) {
  return (
    <GraphProvider repoUrl={repoUrl} branch={branch}>
      <AuditGraphInner target={target} />
    </GraphProvider>
  )
}

function AuditGraphInner({ target }: { target: AuditFocusTarget | null }) {
  const { graph, selectNode } = useGraphContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(undefined)

  const filePathToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const n of graph?.nodes ?? []) {
      map.set(n.filePath, n.id)
    }
    return map
  }, [graph])

  // Camera flight whenever the walkthrough target changes.
  useEffect(() => {
    if (!target || !graph) return
    const primaryPath = target.cycleFiles[0] ?? target.filePath
    if (!primaryPath) return
    const nodeId = filePathToId.get(primaryPath)
    if (!nodeId) return

    selectNode(nodeId)

    // Node coordinates materialize as the force layout ticks; poll a few
    // frames before flying so we never aim at undefined positions.
    let attempts = 0
    let cancelled = false
    const tryFly = () => {
      if (cancelled) return
      const fg = fgRef.current as CameraControls | undefined
      const node = fg?.graphData()?.nodes.find((n) => n.id === nodeId)
      if (!fg || !node || node.x === undefined || node.y === undefined) {
        if (attempts++ < 40) setTimeout(tryFly, 100)
        return
      }
      const dist = 120
      fg.cameraPosition(
        { x: node.x! + dist, y: node.y! + dist * 0.4, z: node.z! + dist },
        { x: node.x!, y: node.y!, z: node.z! },
        800
      )
    }
    tryFly()
    return () => {
      cancelled = true
    }
  }, [target, graph, filePathToId, selectNode])

  const cycleLabel =
    target && target.cycleFiles.length > 1
      ? target.cycleFiles.map((f) => f.split("/").pop()).join(" → ")
      : null

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <GraphCanvas3D fgRef={fgRef} />
      {/* audit HUD */}
      <div className="pointer-events-none absolute left-3 top-3 max-w-[85%] rounded border border-red-900/50 bg-black/80 px-2.5 py-1.5 backdrop-blur">
        {cycleLabel ? (
          <>
            <p className="font-mono text-[10px] uppercase tracking-wide text-red-400">
              cycle path · {target?.cycleFiles.length} files
            </p>
            <p className="truncate font-mono text-xs text-neutral-200">{cycleLabel}</p>
          </>
        ) : target?.filePath ? (
          <>
            <p className="font-mono text-[10px] uppercase tracking-wide text-red-400">audit focus</p>
            <p className="truncate font-mono text-xs text-neutral-200">
              {target.filePath.split("/").pop()}
            </p>
          </>
        ) : (
          <p className="font-mono text-xs text-neutral-500">
            navigate findings to fly the camera
          </p>
        )}
      </div>
    </div>
  )
}