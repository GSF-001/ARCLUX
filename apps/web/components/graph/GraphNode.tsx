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
}

const BASE_RADIUS = 6;

export function GraphNode({ node, position, isSelected, isHovered, onHoverChange }: GraphNodeProps) {
  const color = getGraphNodeColor(node.type, "dark");
  const radius = isSelected ? BASE_RADIUS + 3 : isHovered ? BASE_RADIUS + 1.5 : BASE_RADIUS;

  return (
    <g
      data-node-id={node.id}
      transform={`translate(${position.x}, ${position.y})`}
      onMouseEnter={() => onHoverChange(node.id)}
      onMouseLeave={() => onHoverChange(null)}
      className="cursor-pointer"
    >
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
