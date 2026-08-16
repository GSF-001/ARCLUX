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

// react-force-graph-3d touches `window` at import time (Three.js/WebGL),
// so it must be loaded client-side only -- ssr: false is required.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const NODE_COLORS: Record<string, string> = {
  file: "#0070F3",
  folder: "#8E4EC6",
  "external-package": "#878787",
  route: "#46A758",
  component: "#F2A700",
  hook: "#E5484D",
};

export function GraphCanvas3D() {
  const { graph, isLoading, error, selectedNodeId, selectNode } = useGraphContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // ForceGraph3D needs explicit pixel width/height (not CSS %) or it
  // falls back to a wrong default size, which was inflating this
  // container's height and pushing GraphFocusView's absolute inset-4
  // panel far below the visible viewport in portrait orientation.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    return {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        val: 1,
        color: NODE_COLORS[n.type] ?? "#ededed",
      })),
      links: graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [graph]);

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
