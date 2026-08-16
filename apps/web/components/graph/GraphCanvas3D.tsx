// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { useGraphContext } from "./GraphProvider";
import { graphNodeColors } from "@/theme/graphColors";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ForceGraphMethods } from "react-force-graph-3d";

// react-force-graph-3d touches `window` at import time (Three.js/WebGL),
// so it must be loaded client-side only -- ssr: false is required, not
// optional, or Next.js build/SSR will crash.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

// Fan-in tiers mirror the 2D impact halo (GraphNode.tsx: IMPACT_*_THRESHOLD)
// and the 2D LOD always-label tier (MIN_ZOOM_FOR_ALWAYS_LABEL) so an
// "important file" reads the same in both views. importCounts comes from
// GraphProvider (client-side fan-in over graph.edges).
const IMPACT_HIGH_THRESHOLD = 100;
const IMPACT_MEDIUM_THRESHOLD = 20;

// Sphere radius = cbrt(val) * NODE_REL_SIZE (3d-force-graph). The base dot
// is ~5 units; medium/high fan-in spheres are bigger AND get a ring, the
// 3D analogue of the 2D halo circle.
const NODE_VAL_BASE = 1;
const NODE_VAL_MEDIUM = 2;
const NODE_VAL_HIGH = 4;
const NODE_REL_SIZE = 5;
// Ring sits just outside the sphere surface: cbrt(val)*NODE_REL_SIZE + RING_GAP.
const RING_GAP = 3;
// Camera distance for the double-click "focus node" gesture (2D's
// zoomToNode equivalent for the orbit camera).
const FOCUS_CAMERA_DISTANCE = 90;

interface Graph3DNodeData {
  id: string;
  name: string;
  color: string;
  fanIn: number;
  val: number;
}

function nodeValFor(fanIn: number): number {
  if (fanIn > IMPACT_HIGH_THRESHOLD) return NODE_VAL_HIGH;
  if (fanIn >= IMPACT_MEDIUM_THRESHOLD) return NODE_VAL_MEDIUM;
  return NODE_VAL_BASE;
}

export function GraphCanvas3D() {
  const {
    graph,
    isLoading,
    error,
    selectedNodeId,
    selectNode,
    setHoveredNodeId,
    setContextMenuNodeId,
    importCounts,
  } = useGraphContext();

  // Coarse pointer = touch devices (mobile / Termux). Cheap visual wins:
  // lower sphere geometry resolution, no link particles (they read as noise
  // on small screens anyway) and no MSAA. Fine pointers keep full quality.
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    return {
      nodes: graph.nodes.map((n) => {
        const fanIn = importCounts.get(n.id) ?? 0;
        return {
          id: n.id,
          name: n.label,
          // Same palette as the 2D canvas (GraphNode.tsx ->
          // getGraphNodeColor, dark mode) so a node's color doesn't change
          // when toggling 2D/3D — otherwise the legend in GraphMenu would
          // lie about node types.
          color: graphNodeColors[n.type].dark,
          fanIn,
          val: nodeValFor(fanIn),
        } satisfies Graph3DNodeData;
      }),
      links: graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [graph, importCounts]);

  // Importance ring: a torus just outside the sphere for medium/high fan-in
  // nodes — the 3D analogue of the 2D impact halo (GraphNode.tsx draws a
  // 9/14px circle around the dot for the same thresholds). nodeThreeObjectExtend
  // keeps the default sphere so nodeColor/nodeVal still drive fill/size, and
  // the ring radius is baked into the geometry (3d-force-graph sets the
  // sphere radius via geometry, sphere scale stays 1) so the ring never
  // scales away from the surface.
  const nodeThreeObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      // null -> fall back to the default sphere (runtime-supported, but
      // the d.ts types only allow Object3D, hence the cast).
      if (node.fanIn < IMPACT_MEDIUM_THRESHOLD) return null as unknown as THREE.Object3D;
    const radius = Math.cbrt(node.val) * NODE_REL_SIZE + RING_GAP;
    return new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.15, 8, 48),
      new THREE.MeshBasicMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.35,
      })
    );
  }, []);

  // Recreated only when the selection changes, so 3d-force-graph's
  // prop-change digest (which re-applies node material) only runs then,
  // not on every render.
  const nodeColor = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => (node.id === selectedNodeId ? "#ffffff" : node.color),
    [selectedNodeId]
  );

  const onNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, event: MouseEvent) => {
      selectNode(node.id);
      // Double-click focuses the camera on the node (2D's double-click
      // zoom-to-node equivalent).
      if (event.detail >= 2) {
        graphRef.current?.cameraPosition(
          { x: node.x ?? 0, y: node.y ?? 0, z: (node.z ?? 0) + FOCUS_CAMERA_DISTANCE },
          { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
          400
        );
      }
    },
    [selectNode]
  );

  const onNodeHover = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any | null) => setHoveredNodeId(node ? node.id : null),
    [setHoveredNodeId]
  );

  const onBackgroundClick = useCallback(() => selectNode(null), [selectNode]);

  // Right-click opens the shared GraphContextMenu. That menu positions
  // itself on a pointermove; right-click doesn't guarantee one fires, so
  // synthesize it at the click coordinates.
  const onNodeRightClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, event: MouseEvent) => {
      setContextMenuNodeId(node.id);
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: event.clientX, clientY: event.clientY })
      );
    },
    [setContextMenuNodeId]
  );

  if (isLoading) return <div>Loading graph...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!graph) return null;

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={graphData}
      nodeLabel="name"
      nodeVal="val"
      nodeColor={nodeColor}
      nodeRelSize={NODE_REL_SIZE}
      nodeOpacity={0.9}
      nodeResolution={isCoarsePointer ? 6 : 8}
      nodeThreeObject={nodeThreeObject}
      nodeThreeObjectExtend
      onNodeClick={onNodeClick}
      onNodeHover={onNodeHover}
      onNodeRightClick={onNodeRightClick}
      onBackgroundClick={onBackgroundClick}
      backgroundColor="#000000"
      linkColor={() => "rgba(255,255,255,0.2)"}
      linkDirectionalParticles={isCoarsePointer ? 0 : 1}
      linkDirectionalParticleWidth={1.2}
      showNavInfo={false}
      controlType="orbit"
      rendererConfig={{ antialias: !isCoarsePointer, powerPreference: "high-performance" }}
    />
  );
}
