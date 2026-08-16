// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { memo } from "react";
import { getGraphNodeColor } from "@/theme/graphColors";
import { getNodeIconPath } from "./nodeIcons";
import type { GraphNode as GraphNodeData, GraphNodeType } from "@/packages/shared/types";

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface GraphNodeProps {
  node: GraphNodeData;
  position: GraphNodePosition;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (id: string) => void;
  onHoverChange: (id: string | null) => void;
  /** Number of edges targeting this node (computed client-side from
   * DependencyGraph.edges in GraphProvider.tsx). Drives the impact halo. */
  importCount?: number;
  /** Current viewport zoom scale from GraphTransform. The impact halo
   * only renders past MIN_ZOOM_FOR_HALO to avoid clutter when zoomed
   * out on dense graphs -- see progres/PROGRES-decisions.md. */
  zoomScale?: number;
  /** Touch hit radius (px). Set on coarse-pointer devices so the visual
   * 6px dot still meets the 44px tap target via an invisible larger
   * circle. Undefined on fine pointers (mouse) — desktop keeps precise
   * 6px targeting on dense graphs. */
  hitRadius?: number;
  /** Dimmed because another node is selected/hovered and this one is NOT
   * connected to it (fade-out feedback — GraphCanvas computes the
   * connected set). Applied as group opacity so halo/icon/label fade too. */
  isDimmed?: boolean;
}

const BASE_RADIUS = 6;

// ---------------------------------------------------------------------------
// 2D-only semantic node classification.
//
// The backend graph builder (packages/graph/buildDependencyGraph.ts) emits
// every node with type: "file" — route/component/hook types are only ever
// assigned by packages/indexer/* resolver helpers, which currently feed
// detectors, not the rendered graph. Until the pipeline assigns real types,
// classify here from the same conventions so the canvas matches the
// GraphMenu legend instead of rendering everything in the single "file"
// color. When the pipeline starts emitting real types, node.type wins and
// this whole fallback becomes dead code (keep the `node.type !== "file"`
// short-circuit so it removes cleanly).
//
// Conventions mirrored from packages/indexer/resolveRoutes.ts and the
// component/hook detectors (progres/PROGRES-decisions.md).
const NEXT_APP_ROUTER_ENTRY_FILENAMES = new Set([
  "page",
  "layout",
  "route",
  "loading",
  "error",
  "not-found",
  "template",
  "default",
  "global-error",
]);
const NEXT_APP_ROUTER_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

function getEffectiveNodeType(node: GraphNodeData): GraphNodeType {
  if (node.type !== "file") return node.type;

  const segments = (node.filePath ?? "").split("/");
  const fileName = segments[segments.length - 1] ?? "";
  const extMatch = /\.([^.]+)$/.exec(fileName);
  const ext = extMatch ? "." + extMatch[1] : "";
  const base = extMatch ? fileName.slice(0, -ext.length) : fileName;

  // Next.js App Router entry file inside an app/ folder (page/layout/route/
  // loading/error/not-found/template/default/global-error).
  if (
    segments.includes("app") &&
    NEXT_APP_ROUTER_ENTRY_FILENAMES.has(base) &&
    NEXT_APP_ROUTER_EXTENSIONS.has(ext)
  ) {
    return "route";
  }

  // React hook: use* prefix with a capital letter (useState, useMemo, ...).
  if (/^use[A-Z]/.test(base) && (ext === ".ts" || ext === ".tsx")) {
    return "hook";
  }

  // React component: PascalCase .tsx/.jsx file.
  if ((ext === ".tsx" || ext === ".jsx") && /^[A-Z]/.test(base)) {
    return "component";
  }

  return "file";
}

// Fan-in tiers for the impact halo. Starting thresholds, not yet tuned
// against a wide variety of real repos -- see progres/PROGRES-decisions.md.
const IMPACT_HIGH_THRESHOLD = 100;
const IMPACT_MEDIUM_THRESHOLD = 20;

// Halo only renders once zoomed in past this scale, so overview/zoomed-out
// views of dense graphs don't get cluttered with overlapping halos.
const MIN_ZOOM_FOR_HALO = 1;

// Below this zoom, node icons are too small to read and just cost a
// render -- skip them. Part of a lightweight LOD (level-of-detail)
// pass; see progres/PROGRES-decisions.md (2026-08-07 LOD entry) for
// the fuller plan this is step 1 of.
const MIN_ZOOM_FOR_ICON = 0.5;

// LOD step 2: below this zoom, labels never render even on hover/select
// -- matches the icon threshold so a fully zoomed-out node is just a
// plain dot with no text. Above MIN_ZOOM_FOR_ALWAYS_LABEL, high-importance
// nodes (same threshold as the impact halo's medium tier) show their
// label always, not just on hover/select, since at that zoom level
// there's room and it helps scanning for important files without
// clicking each node.
const MIN_ZOOM_FOR_LABEL = 0.5;
const MIN_ZOOM_FOR_ALWAYS_LABEL = 1.5;

function getImpactHaloRadius(importCount: number): number | null {
  if (importCount > IMPACT_HIGH_THRESHOLD) return 14;
  if (importCount >= IMPACT_MEDIUM_THRESHOLD) return 9;
  return null;
}

function GraphNodeComponent({
  node,
  position,
  isSelected,
  isHovered,
  onHoverChange,
  importCount = 0,
  zoomScale = 1,
  hitRadius,
  isDimmed = false,
}: GraphNodeProps) {
  const effectiveType = getEffectiveNodeType(node);
  const color = getGraphNodeColor(effectiveType, "dark");
  const radius = isSelected ? BASE_RADIUS + 3 : isHovered ? BASE_RADIUS + 1.5 : BASE_RADIUS;
  const impactHaloRadius = zoomScale >= MIN_ZOOM_FOR_HALO ? getImpactHaloRadius(importCount) : null;

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${position.x}, ${position.y})`}
      onMouseEnter={() => onHoverChange(node.id)}
      onMouseLeave={() => onHoverChange(null)}
      className="cursor-pointer"
    >
      {impactHaloRadius !== null && (
        <circle
          r={radius + impactHaloRadius}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.25}
          className="pointer-events-none"
        />
      )}
      {isSelected && (
        <>
          {/* Bright accent ring (selection glow). */}
          <circle r={radius + 8} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.15} />
          <circle r={radius + 5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.5} />
        </>
      )}
      <circle
        r={radius}
        fill={color}
        stroke={isSelected ? "#fff" : "transparent"}
        strokeWidth={1.5}
        opacity={isDimmed ? 0.3 : isSelected || isHovered ? 1 : 0.85}
      />
      {zoomScale >= MIN_ZOOM_FOR_ICON && (
        <path
          d={getNodeIconPath(effectiveType)}
          fill="none"
          stroke="#fff"
          strokeWidth={0.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={isSelected || isHovered ? 0.95 : 0.65}
          className="pointer-events-none"
        />
      )}
      {/* Invisible hit target. Must be LAST so it sits on top: SVG hits
          register against the topmost shape, and the visible dot/icon/
          label all keep pointer-events-none — so the whole hitRadius disk
          becomes the tap target on touch devices. */}
      {hitRadius !== undefined && hitRadius > radius && (
        <circle r={hitRadius} fill="transparent" />
      )}
      {(() => {
        if (zoomScale < MIN_ZOOM_FOR_LABEL) return null;
        const alwaysShow =
          zoomScale >= MIN_ZOOM_FOR_ALWAYS_LABEL && importCount >= IMPACT_MEDIUM_THRESHOLD;
        if (!isSelected && !isHovered && !alwaysShow) return null;
        return (
          <text
            x={radius + 6}
            y={4}
            fontSize={11}
            fontFamily="monospace"
            fill="#EDEDED"
            className="pointer-events-none select-none"
          >
            {node.label}
          </text>
        );
      })()}
    </g>
  );
}

// Memoized: without this, every GraphNode instance re-renders whenever
// GraphCanvas.tsx's transform state changes (pan/zoom), even if that
// specific node's own props (position, selection, hover, importCount)
// haven't changed. On a graph with hundreds of nodes, that's hundreds
// of unnecessary re-renders per pan/zoom frame. Default shallow-compare
// is sufficient here since all props are primitives or stable references.
export const GraphNode = memo(GraphNodeComponent);
