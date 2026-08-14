// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { memo } from "react";
import { getGraphEdgeColor } from "@/theme/graphColors";
import type { GraphEdge as GraphEdgeData } from "@/packages/shared/types";
import type { GraphNodePosition } from "./GraphNode";

export interface GraphEdgeProps {
  edge: GraphEdgeData;
  sourcePos: GraphNodePosition;
  targetPos: GraphNodePosition;
  isHighlighted: boolean;
  /**
   * Rendered radius of source/target node circles, so the line can be
   * shortened to stop cleanly at each boundary instead of ending at the
   * node's center. Defaults to the base GraphNode radius; pass the actual
   * value if selected/hovered nodes render at a different size.
   */
  sourceRadius?: number;
  targetRadius?: number;
}

const DEFAULT_NODE_RADIUS = 7;

/**
 * Returns the point where the line from `from` to `to` crosses the
 * boundary of a circle of `radius` centered at `from`. Used to shorten
 * both ends of an edge so it stops at each node's circle edge instead of
 * its center.
 */
function shortenToCircleBoundary(
  from: GraphNodePosition,
  to: GraphNodePosition,
  radius: number
): GraphNodePosition {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return from;
  return {
    x: from.x + (dx / dist) * radius,
    y: from.y + (dy / dist) * radius,
  };
}

/**
 * Edge type labels ("imports", "calls", etc) were previously rendered at
 * the midpoint on hover/select, but were removed: any node with a large
 * fan-in/fan-out popped one overlapping label per edge, unreadable
 * regardless of whether it was gated to hover or to selection only.
 * GraphFocusView.tsx already lists all of a selected node's connections
 * as clean labeled cards with no overlap — that's the intended place to
 * see per-edge type info now, not the canvas itself.
 */
export function GraphEdgeComponent({
  edge,
  sourcePos,
  targetPos,
  isHighlighted,
  sourceRadius = DEFAULT_NODE_RADIUS,
  targetRadius = DEFAULT_NODE_RADIUS,
}: GraphEdgeProps) {
  // Same hue as GraphLegend at all times (legend reads graphEdgeColors
  // directly) — highlighting changes opacity/width/glow, never color, so
  // a highlighted edge never shows a hue absent from the legend. Glow
  // (not a color swap) is what gives contrast: bumping a dark gray's
  // opacity alone (0.6 -> 1) barely reads as different on a phone screen,
  // since most edges are "import" (deliberately dim at rest, see
  // graphColors.ts comment) — a soft drop-shadow in the same hue reads as
  // "this one is lit up" without introducing a second palette.
  const color = getGraphEdgeColor(edge.type, "dark");

  const adjustedSource = shortenToCircleBoundary(sourcePos, targetPos, sourceRadius);
  const adjustedTarget = shortenToCircleBoundary(targetPos, sourcePos, targetRadius);

  return (
    <line
      x1={adjustedSource.x}
      y1={adjustedSource.y}
      x2={adjustedTarget.x}
      y2={adjustedTarget.y}
      stroke={color}
      strokeWidth={isHighlighted ? 2 : 1}
      strokeOpacity={isHighlighted ? 1 : 0.35}
      style={isHighlighted ? { filter: `drop-shadow(0 0 3px ${color})` } : undefined}
      className="pointer-events-none"
    />
  );
}

// Memoized for the same reason as GraphNode: GraphCanvas re-renders on every
// pan/zoom frame (transform state), but an edge's own props (edge, sourcePos,
// targetPos, isHighlighted) are stable across those frames — without memo,
// hundreds of <line> elements re-render per pointermove for zero visual
// change. Default shallow-compare is sufficient (all props are primitives or
// stable references).
export const GraphEdge = memo(GraphEdgeComponent);
