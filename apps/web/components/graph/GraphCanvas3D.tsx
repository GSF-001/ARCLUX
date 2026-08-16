// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Visual parity pass with GraphNode.tsx (2D): same color mapping, same
// importCount-driven halo tiers, same selection highlight -- rebuilt as
// real Three.js geometry (sphere + glowing torus ring) instead of flat
// SVG circles, since 3D space can support actual depth/glow that 2D
// can't. Ring pulses gently via onEngineTick; kept lightweight (opacity
// sine wave only, no per-frame geometry rebuild) to avoid tanking FPS
// on dense graphs.

"use client";

fix/graph-menu-3d-toggle
import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { useGraphContext } from "./GraphProvider";
import { getGraphNodeColor } from "@/theme/graphColors";
import type { GraphNodeType } from "@/packages/shared/types";

import { useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { useGraphContext } from "./GraphProvider";
import { graphNodeColors } from "@/theme/graphColors";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ForceGraphMethods } from "react-force-graph-3d";
 ARCLUX.main

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

fix/graph-menu-3d-toggle
// Mirrors GraphNode.tsx (2D) thresholds exactly -- keep these two files
// in sync if the tiers ever get tuned.
const IMPACT_HIGH_THRESHOLD = 100;
const IMPACT_MEDIUM_THRESHOLD = 20;
const BASE_RADIUS = 4;

interface HaloRingEntry {
  mesh: THREE.Mesh;
  baseOpacity: number;
}

function getHaloTier(importCount: number): { ringRadius: number; opacity: number } | null {
  if (importCount > IMPACT_HIGH_THRESHOLD) return { ringRadius: 9, opacity: 0.55 };
  if (importCount >= IMPACT_MEDIUM_THRESHOLD) return { ringRadius: 6.5, opacity: 0.4 };
  return null;
}

export function GraphCanvas3D() {
  const { graph, isLoading, error, selectedNodeId, selectNode, importCounts } = useGraphContext();
  const haloRingsRef = useRef<Map<string, HaloRingEntry>>(new Map());

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
  ARCLUX.main

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    return {
      fix/graph-menu-3d-toggle
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        type: n.type as GraphNodeType,
        importCount: importCounts.get(n.id) ?? 0,
      })),

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
      })
      ARCLUX.main
      links: graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [graph, importCounts]);
 fix/graph-menu-3d-toggle


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
 ARCLUX.main

  if (isLoading) return <div>Loading graph...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!graph) return null;

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={graphData}
      nodeLabel="name"
     fix/graph-menu-3d-toggle
      nodeThreeObjectExtend={false}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodeThreeObject={(node: any) => {
        const color = getGraphNodeColor(node.type as GraphNodeType, "dark");
        const isSelected = node.id === selectedNodeId;
        const halo = getHaloTier(node.importCount ?? 0);
        const radius = isSelected ? BASE_RADIUS + 1.5 : BASE_RADIUS;

        const group = new THREE.Group();

        const sphereGeom = new THREE.SphereGeometry(radius, 20, 20);
        const sphereMat = new THREE.MeshLambertMaterial({
          color,
          emissive: color,
          emissiveIntensity: isSelected ? 0.6 : 0.2,
          transparent: true,
          opacity: isSelected ? 1 : 0.92,
        });
        group.add(new THREE.Mesh(sphereGeom, sphereMat));

        if (isSelected) {
          const selGeom = new THREE.SphereGeometry(radius + 4, 16, 16);
          const selMat = new THREE.MeshBasicMaterial({
            color: "#ffffff",
            transparent: true,
            opacity: 0.12,
            side: THREE.BackSide,
          });
          group.add(new THREE.Mesh(selGeom, selMat));
        }

        if (halo) {
          const ringGeom = new THREE.TorusGeometry(radius + halo.ringRadius, 0.5, 8, 40);
          const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: halo.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const ring = new THREE.Mesh(ringGeom, ringMat);
          // Random-ish fixed tilt per node (based on id hash) so rings
          // don\'t all face the exact same way -- reads as more organic
          // than a uniform wall of flat discs.
          const hash = String(node.id)
            .split("")
            .reduce((acc: number, ch: string) => acc + ch.charCodeAt(0), 0);
          ring.rotation.x = (hash % 7) * 0.2;
          ring.rotation.y = (hash % 5) * 0.3;
          group.add(ring);
          haloRingsRef.current.set(String(node.id), { mesh: ring, baseOpacity: halo.opacity });
        }

        return group;
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodeClick={(node: any) => selectNode(node.id)}
      onEngineTick={() => {
        const t = performance.now() / 1000;
        for (const { mesh, baseOpacity } of haloRingsRef.current.values()) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = baseOpacity * (0.7 + 0.3 * Math.sin(t * 2 + mesh.id));
        }
      }}

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
      ARCLUX.main
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
