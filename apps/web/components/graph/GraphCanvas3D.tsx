// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useGraphContext } from "./GraphProvider";

// react-force-graph-3d touches `window` at import time (Three.js/WebGL),
// so it must be loaded client-side only -- ssr: false is required, not
// optional, or Next.js build/SSR will crash.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

// Color coding by node type, matches whatever palette the 2D view uses --
// adjust if GraphNode.tsx already defines a shared color map to import
// instead of duplicating here.
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

  if (isLoading) return <div>Loading graph...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!graph) return null;

  return (
    <ForceGraph3D
      graphData={graphData}
      nodeLabel="name"
      nodeColor={(node: { id: string; color: string }) => (node.id === selectedNodeId ? "#ffffff" : node.color)}
      onNodeClick={(node: { id: string }) => selectNode(node.id)}
      backgroundColor="#000000"
      linkColor={() => "rgba(255,255,255,0.2)"}
      linkDirectionalParticles={1}
      linkDirectionalParticleWidth={1.2}
    />
  );
}
