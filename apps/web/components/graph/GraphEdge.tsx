// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { getGraphEdgeColor } from "@/theme/graphColors";
import type { GraphEdge as GraphEdgeData } from "@/packages/shared/types";
import type { GraphNodePosition } from "./GraphNode";

export interface GraphEdgeProps {
  edge: GraphEdgeData;
  sourcePos: GraphNodePosition;
  targetPos: GraphNodePosition;
  isHighlighted: boolean;
}

export function GraphEdge({ edge, sourcePos, targetPos, isHighlighted }: GraphEdgeProps) {
  const color = getGraphEdgeColor(edge.type, "dark");

  return (
    <line
      x1={sourcePos.x}
      y1={sourcePos.y}
      x2={targetPos.x}
      y2={targetPos.y}
      stroke={color}
      strokeWidth={isHighlighted ? 1.5 : 0.75}
      strokeOpacity={isHighlighted ? 0.9 : 0.35}
      className="pointer-events-none"
    />
  );
}
