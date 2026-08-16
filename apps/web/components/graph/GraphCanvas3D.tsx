// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { useGraphContext } from "./GraphProvider";
import { getEffectiveNodeType } from "./GraphNode";
import type { ForceGraphMethods } from "react-force-graph-3d";

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

// ---------------------------------------------------------------------------
// Hub count badge (3D)
//
// Same rule and tier colors as the 2D canvas (GraphNode.tsx): only
// high-impact hubs (importCount >= 5) show their count, as a small pill
// sprite hovering above the node. Unlike 2D there is no zoom gate: sprites
// scale with camera distance naturally, and force-graph has no per-frame
// camera hook to toggle visibility without rebuilding every node object on
// every camera move (which would be worse for perf than a handful of
// always-on pills). Revisit if overviews of very dense graphs look busy.
// ---------------------------------------------------------------------------
const HUB_BADGE_MIN_COUNT = 5;
// Neutral pill for the 5..19 tier (red/orange reuse IMPACT_TINT_*).
const BADGE_FILL_BASE = "#3D444D";
const BADGE_TEXT_LIGHT = "#FFFFFF";
// Dark text on the orange pill for contrast (orange + white fails WCAG).
const BADGE_TEXT_DARK = "#1A1A1A";

// Sphere badge textures: used as the MAP of the hub sphere itself, so the
// count sits in the CENTER OF THE NODE (a billboard sprite at the node
// center fails the depth test against the sphere's front surface and
// becomes invisible — KI-061). The canvas is square and fully opaque (the
// sphere must stay solid; transparent map corners would erase its edges).
// Cached by count × ring color.
const sphereBadgeTextureCache = new Map<string, THREE.CanvasTexture>();

function getSphereBadgeTexture(count: number, ringColor?: string): THREE.CanvasTexture {
  const cacheKey = `${count}|${ringColor ?? ""}`;
  const cached = sphereBadgeTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  const size = 256; // device px, square
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const label = String(count);
    const digits = label.length;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 10;

    const fill =
      count > IMPACT_HIGH_THRESHOLD
        ? IMPACT_TINT_HIGH
        : count >= IMPACT_MEDIUM_THRESHOLD
          ? IMPACT_TINT_MEDIUM
          : BADGE_FILL_BASE;
    const textFill =
      count >= IMPACT_MEDIUM_THRESHOLD && count <= IMPACT_HIGH_THRESHOLD
        ? BADGE_TEXT_DARK
        : BADGE_TEXT_LIGHT;

    // Opaque tier fill across the whole canvas.
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, size, size);

    if (ringColor) {
      // Type-color ring near the edge (legend identity, like the 2D stroke).
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 14;
      ctx.stroke();
    }

    // Number dead-center; font auto-fits the circle.
    const maxFont = 96;
    const fontSize = Math.min(maxFont, Math.floor((size * 0.52) / Math.max(digits * 0.58, 1)));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = textFill;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  sphereBadgeTextureCache.set(cacheKey, texture);
  return texture;
}

type NodeDatum = {
  id: string;
  name: string;
  color: string;
  /** Base node-type color (before importance tint) — the badge ring color. */
  ringColor: string;
  importCount: number;
  isSelected: boolean;
};

function buildNodeObject(node: NodeDatum): THREE.Object3D {
  const group = new THREE.Group();
  const displayColor = node.isSelected ? "#ffffff" : node.color;

  // Hub nodes (count >= 5) wear the count ON the sphere: the tier-colored
  // texture with the number becomes the sphere's map, so the digit sits in
  // the CENTER of the node circle (a sprite at the node center would be
  // hidden behind the sphere's front surface — KI-061). The core is scaled
  // up a little so the number reads better.
  const isHub = node.importCount >= HUB_BADGE_MIN_COUNT;
  const core = new THREE.Mesh(
    CORE_GEOMETRY,
    isHub
      ? new THREE.MeshBasicMaterial({
          map: getSphereBadgeTexture(node.importCount, node.ringColor),
        })
      : new THREE.MeshBasicMaterial({ color: displayColor })
  );
  if (isHub) core.scale.setScalar(1.3);
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

export interface GraphCanvas3DProps {
  /** Mutable handle the parent fills with the live ForceGraph3D instance;
   * GraphMenu reads it to drive camera zoom/fit in 3D mode. */
  fgRef: MutableRefObject<ForceGraphMethods | undefined>;
}

export function GraphCanvas3D({ fgRef }: GraphCanvas3DProps) {
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
        const baseColor = NODE_COLORS[getEffectiveNodeType(n)] ?? "#ededed";
        const importCount = importCounts.get(n.id) ?? 0;
        return {
          id: n.id,
          name: n.label,
          val: 1,
          color: getImportanceColor(baseColor, importCount),
          ringColor: baseColor,
          importCount,
        };
      }),
      links: graph.edges.map((e) => ({ source: e.source, target: e.target })),
    };
    // NOTE: selectedNodeId is deliberately NOT a dependency. graphData is
    // the source of the d3 simulation — rebuilding it on every selection
    // made react-force-graph-3d restart the whole layout from scratch
    // ("clicking a node re-renders everything", user feedback). Selection
    // visuals are driven by the nodeThreeObject / linkColor props below,
    // whose fresh closures on re-render only rebuild the node/link objects
    // (keeps positions), never the simulation.
  }, [graph, importCounts]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      {isLoading && <div>Loading graph...</div>}
      {error && <div>Error: {error}</div>}
      {!isLoading && !error && graph && dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph3D
          ref={fgRef}
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
          linkColor={(link) => {
            // Selection highlight: the selected node's edges stay bright so
            // the user can navigate the map along them (2D canvas does the
            // same via its connected-node set). The fresh closure on every
            // render makes the kapsule rebuild links only — the simulation
            // and node positions are untouched (see graphData comment).
            const l = link as { source: string; target: string };
            return selectedNodeId !== null &&
              (l.source === selectedNodeId || l.target === selectedNodeId)
              ? "#E5E5E5"
              : "rgba(255,255,255,0.12)";
          }}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.2}
        />
      )}
    </div>
  );
}
