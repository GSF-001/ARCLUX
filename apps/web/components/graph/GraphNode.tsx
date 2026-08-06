// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { getGraphNodeColor } from "@/theme/graphColors";
import { getNodeIconPath } from "./nodeIcons";
import type { GraphNode as GraphNodeData } from "@/packages/shared/types";

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
}

const BASE_RADIUS = 6;

// Fan-in tiers for the impact halo. Starting thresholds, not yet tuned
// against a wide variety of real repos -- see progres/PROGRES-decisions.md.
const IMPACT_HIGH_THRESHOLD = 100;
const IMPACT_MEDIUM_THRESHOLD = 20;

// Halo only renders once zoomed in past this scale, so overview/zoomed-out
// views of dense graphs don't get cluttered with overlapping halos.
const MIN_ZOOM_FOR_HALO = 1;

function getImpactHaloRadius(importCount: number): number | null {
  if (importCount > IMPACT_HIGH_THRESHOLD) return 14;
  if (importCount >= IMPACT_MEDIUM_THRESHOLD) return 9;
  return null;
}

export function GraphNode({
  node,
  position,
  isSelected,
  isHovered,
  onHoverChange,
  importCount = 0,
  zoomScale = 1,
}: GraphNodeProps) {
  const color = getGraphNodeColor(node.type, "dark");
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
        <circle r={radius + 5} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.4} />
      )}
      <circle
        r={radius}
        fill={color}
        stroke={isSelected ? "#fff" : "transparent"}
        strokeWidth={1.5}
        opacity={isSelected || isHovered ? 1 : 0.85}
      />
      <path
        d={getNodeIconPath(node.type)}
        fill="none"
        stroke="#fff"
        strokeWidth={0.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={isSelected || isHovered ? 0.95 : 0.65}
        className="pointer-events-none"
      />
      {(isSelected || isHovered) && (
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
      )}
    </g>
  );
}
