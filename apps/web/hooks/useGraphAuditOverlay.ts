// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as THREE from "three"
import type { ForceGraphMethods } from "react-force-graph-3d"

/**
 * Audit overlay engine — LIVE graph reactions while an audit runs.
 *
 * Architecture rule honored: GraphCanvas3D.tsx (core renderer) is never
 * touched. Instead this hook drives animations from OUTSIDE through the
 * shared fgRef: force-graph keeps each node's three.js object at
 * `node.__threeObj`, so every animation frame we can walk the live
 * scene graph and tween materials of nodes that carry findings.
 *
 * Behavior:
 *  - As findings stream in, flagged nodes get a severity-colored halo
 *    sphere that breathes (sin-wave scale + opacity) — "the graph
 *    discovered a wound" moment, one node at a time.
 *  - While scanning, non-flagged nodes dim slightly (backdrop focus).
 *  - Stop() clears halos and restores everything (materials disposed).
 */

export type AuditSeverity = "critical" | "high" | "medium" | "low" | "error" | "warning" | "info"

const SEVERITY_COLOR: Record<string, number> = {
  critical: 0xff3b30,
  error: 0xff3b30,
  high: 0xff9f0a,
  warning: 0xff9f0a,
  medium: 0xffd60a,
  low: 0x8e8e93,
  info: 0x8e8e93,
}

export interface AuditOverlayFinding {
  filePath: string
  severity: AuditSeverity
}

interface HaloRecord {
  mesh: import("three").Mesh
  baseScale: number
}

export interface UseGraphAuditOverlayReturn {
  /** Findings currently flagged on the graph. */
  findings: AuditOverlayFinding[]
  /** True between start() and stop(). */
  isScanning: boolean
  /** Begin a scan session — findings stream in via flag(). */
  start: () => void
  /** Flag one more finding (idempotent per filePath+severity). */
  flag: (finding: AuditOverlayFinding) => void
  /** End the session: keeps halos breathing? No — restores the graph. */
  stop: (keepHalos?: boolean) => void
  /** Remove all halos + restore dims (alias of stop(false)). */
  clear: () => void
}

export function useGraphAuditOverlay(
  fgRef: React.MutableRefObject<ForceGraphMethods | undefined>,
  /** filePath → nodeId, built from GraphProvider's graph (NOT the scene —
   *  GraphCanvas3D's node objects don't carry filePath, so building this
   *  map from graphData() never matched anything: the original bug). */
  filePathToId: Map<string, string>
): UseGraphAuditOverlayReturn {
  const [findings, setFindings] = useState<AuditOverlayFinding[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const rafRef = useRef<number | null>(null)
  const halosRef = useRef<Map<string, HaloRecord>>(new Map())
  const scannedRef = useRef(false)

  const disposeHalos = useCallback(() => {
    for (const rec of halosRef.current.values()) {
      rec.mesh.parent?.remove(rec.mesh)
      const mat = rec.mesh.material
      if (mat && "dispose" in mat && typeof mat.dispose === "function") mat.dispose()
    }
    halosRef.current.clear()
  }, [])

  const restore = useCallback(() => {
    const fg = fgRef.current as unknown as { graphData?: () => { nodes: unknown[] } } | undefined
    if (!fg?.graphData) return
    for (const node of fg.graphData().nodes as { __threeObj?: { children?: { material?: { opacity?: number; transparent?: boolean } }[] } }[]) {
      const obj = node.__threeObj
      if (!obj?.children) continue
      for (const child of obj.children) {
        const mat = child.material
        if (mat && typeof mat === "object" && "opacity" in mat) {
          // Glow spheres use 0.18/0.35, cores are opaque — restore by
          // snapping transparency off; the renderer rebuilds correct
          // values on the next nodeThreeObject pass anyway.
          mat.transparent = false
        }
      }
    }
  }, [fgRef])

  const stop = useCallback(
    (keepHalos = false) => {
      setIsScanning(false)
      scannedRef.current = false
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (!keepHalos) {
        disposeHalos()
        restore()
        setFindings([])
      }
    },
    [disposeHalos, restore]
  )

  const flag = useCallback((finding: AuditOverlayFinding) => {
    setFindings((prev) => [...prev, finding])
  }, [])

  const start = useCallback(() => {
    disposeHalos()
    setFindings([])
    setIsScanning(true)
    scannedRef.current = false
  }, [disposeHalos])

  // The animation loop: breathing halos for flagged nodes + dim backdrop
  // while scanning. Runs only while halos exist or scanning.
  useEffect(() => {
    if (!isScanning && halosRef.current.size === 0) return

    const tick = (t: number) => {
      const fg = fgRef.current as unknown as
        | { graphData?: () => { nodes: unknown[] } }
        | undefined
      if (fg?.graphData) {
        const nodes = fg.graphData().nodes as {
          id: string
          filePath?: string
          __threeObj?: import("three").Group
        }[]

        const pathById = new Map<string, string>()
        for (const n of nodes) if (n.filePath) pathById.set(n.filePath, n.id)

        // Ensure each finding filePath has a halo on its node.
        for (const f of findings) {
          const nodeId = pathById.get(f.filePath)
          if (!nodeId) continue
          const key = `${nodeId}:${f.severity}`
          if (halosRef.current.has(key)) continue

          const node = nodes.find((n) => n.id === nodeId)
          const obj = node?.__threeObj
          if (!obj) continue

          const halo = new THREE.Mesh(
            new THREE.SphereGeometry(6.5, 16, 16),
            new THREE.MeshBasicMaterial({
              color: SEVERITY_COLOR[f.severity] ?? 0xff3b30,
              transparent: true,
              opacity: 0.45,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
          )
          obj.add(halo)
          halosRef.current.set(key, { mesh: halo, baseScale: 1 })
        }
      }

      // Breathe every halo.
      const breath = (Math.sin(t / 320) + 1) / 2 // 0..1
      for (const rec of halosRef.current.values()) {
        rec.mesh.scale.setScalar(0.9 + breath * 0.55)
        const mat = rec.mesh.material as { opacity: number }
        mat.opacity = 0.2 + breath * 0.5
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [findings, isScanning, fgRef, filePathToId])

  const clear = useCallback(() => stop(false), [stop])

  // Unmount safety.
  useEffect(() => () => disposeHalos(), [disposeHalos])

  return { findings, isScanning, start, flag, stop, clear }
}