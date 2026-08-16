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
import { graphNodeColors } from "@/theme/graphColors";

// react-force-graph-3d touches `window` at import time (Three.js/WebGL),
// so it must be loaded client-side only -- ssr: false is required, not
// optional, or Next.js build/SSR will crash.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export function GraphCanvas3D() {
  const { graph, isLoading, error, selectedNodeId, selectNode } = useGraphContext();

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    return {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        val: 1,
        // Same palette as the 2D canvas (GraphNode.tsx -> getGraphNodeColor,
        // dark mode) so a node's color doesn't change when toggling 2D/3D —
        // otherwise the legend in GraphMenu would lie about node types.
        color: graphNodeColors[n.type].dark,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodeColor={(node: any) => (node.id === selectedNodeId ? "#ffffff" : node.color)}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodeClick={(node: any, _event: MouseEvent) => selectNode(node.id)}
      backgroundColor="#000000"
      linkColor={() => "rgba(255,255,255,0.2)"}
      linkDirectionalParticles={1}
      linkDirectionalParticleWidth={1.2}
    />
  );
}
