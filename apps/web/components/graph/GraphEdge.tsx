// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { getGraphEdgeColor, getGraphEdgeHighlightColor } from "@/theme/graphColors";
import type { GraphEdge as GraphEdgeData } from "@/packages/shared/types";
import type { GraphNodePosition } from "./GraphNode";

export interface GraphEdgeProps {
  edge: GraphEdgeData;
  sourcePos: GraphNodePosition;
  targetPos: GraphNodePosition;
  isHighlighted: boolean;
}

const EDGE_LABELS: Record<string, string> = {
  import: "imports",
  export: "exports",
  call: "calls",
  "route-link": "routes to",
};

/**
 * isHighlighted covers BOTH selected and hovered (see GraphCanvas.tsx).
 * That means hovering a high fan-in hub node will pop a label on every one
 * of its edges at once — could get noisy on a dense hub. Not restricted to
 * click-only for now since that matches the existing highlight behavior
 * (glow ring, thicker stroke) already used for both states. Revisit if
 * hover turns out too busy in practice.
 *
 * KNOWN LIMITATION: line endpoints are node CENTERS, not circle edges, so
 * the arrowhead marker lands under/inside the target node's circle rather
 * than stopping cleanly at its boundary. Fixing this needs the line to be
 * shortened by the node's rendered radius, which isn't threaded through
 * here yet — out of scope for this change.
 */
export function GraphEdge({ edge, sourcePos, targetPos, isHighlighted }: GraphEdgeProps) {
  const dimColor = getGraphEdgeColor(edge.type, "dark");
  const brightColor = getGraphEdgeHighlightColor(edge.type);
  const color = isHighlighted ? brightColor : dimColor;

  const midX = (sourcePos.x + targetPos.x) / 2;
  const midY = (sourcePos.y + targetPos.y) / 2;
  const label = EDGE_LABELS[edge.type] ?? edge.type;

  return (
    <g>
      <line
        x1={sourcePos.x}
        y1={sourcePos.y}
        x2={targetPos.x}
        y2={targetPos.y}
        stroke={color}
        strokeWidth={isHighlighted ? 1.5 : 0.75}
        strokeOpacity={isHighlighted ? 1 : 0.35}
        markerEnd={isHighlighted ? `url(#arrow-${edge.type})` : undefined}
        className="pointer-events-none"
      />
      {isHighlighted && (
        <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
          <rect
            x={-label.length * 3.1}
            y={-7}
            width={label.length * 6.2}
            height={14}
            rx={3}
            fill="#000"
            fillOpacity={0.75}
          />
          <text x={0} y={4} fontSize={10} fontFamily="monospace" fill={brightColor} textAnchor="middle">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}
