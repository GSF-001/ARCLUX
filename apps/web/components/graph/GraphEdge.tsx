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
