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
import * as THREE from "three";
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

const IMPACT_HIGH_THRESHOLD = 100;
const IMPACT_MEDIUM_THRESHOLD = 20;

const IMPACT_TINT_HIGH = "#FF3B30";
const IMPACT_TINT_MEDIUM = "#FFB224";

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

function getImportanceColor(baseColor: string, importCount: number): string {
  if (importCount > IMPACT_HIGH_THRESHOLD) return mixColor(baseColor, IMPACT_TINT_HIGH, 0.75);
  if (importCount >= IMPACT_MEDIUM_THRESHOLD) return mixColor(baseColor, IMPACT_TINT_MEDIUM, 0.55);
  return baseColor;
}

function getImpactTier(importCount: number): "high" | "medium" | "none" {
  if (importCount > IMPACT_HIGH_THRESHOLD) return "high";
  if (importCount >= IMPACT_MEDIUM_THRESHOLD) return "medium";
  return "none";
}

const CORE_GEOMETRY = new THREE.SphereGeometry(4, 16, 16);
const GLOW_GEOMETRY = new THREE.SphereGeometry(4, 16, 16);
const RING_GEOMETRY = new THREE.RingGeometry(7, 9, 32);

type NodeDatum = {
  id: string;
  name: string;
  color: string;
  importCount: number;
  isSelected: boolean;
};

function buildNodeObject(node: NodeDatum): THREE.Object3D {
  const group = new THREE.Group();
  const displayColor = node.isSelected ? "#ffffff" : node.color;

  const core = new THREE.Mesh(CORE_GEOMETRY, new THREE.MeshBasicMaterial({ color: displayColor }));
  group.add(core);

  const glowScale = node.isSelected ? 1.9 : 1.5;
  const glow = new THREE.Mesh(
    GLOW_GEOMETRY,
    new THREE.MeshBasicMaterial({
      color: displayColor,
      transparent: true,
      opacity: node.isSelected ? 0.35 : 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.scale.setScalar(glowScale);
  group.add(glow);

  const tier = getImpactTier(node.importCount);
  if (tier !== "none") {
    const ringColor = tier === "high" ? IMPACT_TINT_HIGH : IMPACT_TINT_MEDIUM;
    const ring = new THREE.Mesh(
      RING_GEOMETRY,
      new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: tier === "high" ? 0.85 : 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = Math.PI / 2.6;
    if (tier === "high") ring.scale.setScalar(1.3);
    group.add(ring);
  }

  return group;
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
          importCount,
        };
      }),
      links: graph.edges.map((e) => ({ source: e.source, target: e.target })),
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
          nodeThreeObject={(node) => {
            const n = node as unknown as NodeDatum;
            return buildNodeObject({ ...n, isSelected: n.id === selectedNodeId });
          }}
          nodeThreeObjectExtend={false}
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
