// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useMemo } from "react";
import { useGraphContext } from "./GraphProvider";

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
const PADDING = 20;

export function Minimap() {
  const { graph, positions, transform, dimensions } = useGraphContext();

  const bounds = useMemo(() => {
    if (positions.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of positions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
    return { minX, minY, maxX, maxY };
  }, [positions]);

  if (!graph || !bounds || graph.nodes.length === 0) return null;

  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min(
    (MINIMAP_WIDTH - PADDING) / contentWidth,
    (MINIMAP_HEIGHT - PADDING) / contentHeight
  );

  function toMinimapCoords(x: number, y: number) {
    return {
      x: (x - bounds!.minX) * scale + PADDING / 2,
      y: (y - bounds!.minY) * scale + PADDING / 2,
    };
  }

  // Approximate visible viewport rect in world space, then map to minimap space
  const viewportTopLeft = toMinimapCoords(
    -transform.x / transform.scale,
    -transform.y / transform.scale
  );
  const viewportSize = {
    width: (dimensions.width / transform.scale) * scale,
    height: (dimensions.height / transform.scale) * scale,
  };

  return (
    <div className="absolute bottom-4 right-4 z-10 overflow-hidden rounded-lg border bg-background/90 shadow-sm backdrop-blur">
      <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT}>
        {graph.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const p = toMinimapCoords(pos.x, pos.y);
          return <circle key={node.id} cx={p.x} cy={p.y} r={1.5} fill="#52A8FF" opacity={0.7} />;
        })}
        <rect
          x={viewportTopLeft.x}
          y={viewportTopLeft.y}
          width={viewportSize.width}
          height={viewportSize.height}
          fill="none"
          stroke="#EDEDED"
          strokeWidth={1}
          strokeOpacity={0.5}
        />
      </svg>
    </div>
  )
}
