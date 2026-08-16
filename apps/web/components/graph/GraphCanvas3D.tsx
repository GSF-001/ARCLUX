// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useGraphContext } from "./GraphProvider";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const NODE_COLORS: Record<string, string> = {
  file: "#0070F3",
  folder: "#8E4EC6",
  "external-package": "#878787",
  route: "#46A758",
  component: "#F2A700",
  hook: "#E5484D",
};

// Same fan-in tiers as GraphNode.tsx's impact halo (IMPACT_HIGH_THRESHOLD /
// IMPACT_MEDIUM_THRESHOLD) -- kept in sync manually since 2D reads these
// from GraphNode.tsx's own module scope, not a shared export yet.
const IMPACT_HIGH_THRESHOLD = 100;
const IMPACT_MEDIUM_THRESHOLD = 20;

// Warm colors that get MORE intense as importance rises, applied as a tint
// over the node's base type-color rather than replacing it -- so you can
// still tell "this is a route" vs "this is a hook" AND "this is critical"
// at the same time, instead of importance fully overriding type identity.
const IMPACT_TINT_HIGH = "#FF3B30"; // hot red -- 100+ files depend on this
const IMPACT_TINT_MEDIUM = "#FFB224"; // amber -- 20-99 files depend on this

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixColor(baseHex: string, tintHex: string, amount: number): string {
  const base = hexToRgb(baseHex);
  const tint = hexToRgb(tintHex);
  const r = Math.round(base.r + (tint.r - base.r) * amount);
  const g = Math.round(base.g + (tint.g - base.g) * amount);
  const b = Math.round(base.b + (tint.b - base.b) * amount);
  return `rgb(${r},${g},${b})`;
}

/** Blends the node's type color toward a warning tint based on fan-in
 * (importCount), same thresholds as GraphNode.tsx's halo tiers. Low
 * importance = pure type color. High importance = strongly tinted red. */
function getImportanceColor(baseColor: string, importCount: number): string {
  if (importCount > IMPACT_HIGH_THRESHOLD) return mixColor(baseColor, IMPACT_TINT_HIGH, 0.75);
  if (importCount >= IMPACT_MEDIUM_THRESHOLD) return mixColor(baseColor, IMPACT_TINT_MEDIUM, 0.55);
  return baseColor;
}

export function GraphCanvas3D() {
  const { graph, isLoading, error, selectedNodeId, selectNode, importCounts } = useGraphContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    return {
      nodes: graph.nodes.map((n) => {
        const baseColor = NODE_COLORS[n.type] ?? "#ededed";
        const importCount = importCounts.get(n.id) ?? 0;
        return {
          id: n.id,
          name: n.label,
          val: 1,
          color: getImportanceColor(baseColor, importCount),
        };
      }),
      links: graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [graph, importCounts]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      {isLoading && <div>Loading graph...</div>}
      {error && <div>Error: {error}</div>}
      {!isLoading && !error && graph && dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph3D
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={(node) => {
            const n = node as { id: string; color: string };
            return n.id === selectedNodeId ? "#ffffff" : n.color;
          }}
          onNodeClick={(node) => selectNode((node as { id: string }).id)}
          backgroundColor="#000000"
          linkColor={() => "rgba(255,255,255,0.2)"}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.2}
        />
      )}
    </div>
  );
}
