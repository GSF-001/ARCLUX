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

import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { useGraphContext } from "./GraphProvider";
import { getGraphNodeColor } from "@/theme/graphColors";
import type { GraphNodeType } from "@/packages/shared/types";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

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

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    return {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        type: n.type as GraphNodeType,
        importCount: importCounts.get(n.id) ?? 0,
      })),
      links: graph.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [graph, importCounts]);

  if (isLoading) return <div>Loading graph...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!graph) return null;

  return (
    <ForceGraph3D
      graphData={graphData}
      nodeLabel="name"
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
      backgroundColor="#000000"
      linkColor={() => "rgba(255,255,255,0.2)"}
      linkDirectionalParticles={1}
      linkDirectionalParticleWidth={1.2}
    />
  );
}
