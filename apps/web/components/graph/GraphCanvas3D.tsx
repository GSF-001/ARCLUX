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

// Soft circular sprite (radial gradient, white center fading to transparent)
// drawn once on an offscreen canvas and reused as every particle's texture.
// This is what gives points a soft "dust" look instead of hard square dots.
let cachedSpriteTexture: THREE.Texture | null = null;
function getSpriteTexture(): THREE.Texture {
  if (cachedSpriteTexture) return cachedSpriteTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  cachedSpriteTexture = new THREE.CanvasTexture(canvas);
  return cachedSpriteTexture;
}

// Camera distance below which the impact-count number becomes visible --
// tuned to roughly correspond to ~50% zoom (closer than default orbit
// distance, but before you are right on top of the node).
const NUMBER_VISIBLE_DISTANCE = 120;

// Text sprites cached per unique number string -- most nodes share small
// counts (0, 1, 2...), so this avoids redrawing identical canvases.
const numberTextureCache = new Map<string, THREE.Texture>();
function getNumberTexture(value: number): THREE.Texture {
  const key = String(value);
  const cached = numberTextureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Soft dark outline so the white number stays readable regardless of
  // the node's own color behind it.
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeText(key, size / 2, size / 2);
  ctx.fillText(key, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  numberTextureCache.set(key, texture);
  return texture;
}

const CORE_GEOMETRY = new THREE.SphereGeometry(4, 16, 16);

// Glow dust: particles scattered in a thin shell around the core radius,
// random jitter per particle instead of a uniform surface -- reads as a
// soft "planet atmosphere" texture rather than a flat glass sphere.
function buildGlowDustGeometry(count: number, radius: number, spread: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius + (Math.random() - 0.5) * spread;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geo;
}

// Ring dust: particles scattered in a flat annulus (donut shape) with
// thickness jitter -- the Saturn-ring dust-particle look from the
// reference image, instead of a flat solid ring mesh.
function buildRingDustGeometry(count: number, innerR: number, outerR: number, thickness: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = innerR + Math.random() * (outerR - innerR);
    positions[i * 3] = r * Math.cos(angle);
    positions[i * 3 + 1] = (Math.random() - 0.5) * thickness;
    positions[i * 3 + 2] = r * Math.sin(angle);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geo;
}

// Cached once, reused across all nodes -- only material color/opacity
// differs per node, geometry (particle positions) is shared.
const GLOW_DUST_GEOMETRY = buildGlowDustGeometry(60, 5.5, 2.5);
const RING_DUST_GEOMETRY_MEDIUM = buildRingDustGeometry(90, 6.5, 9, 1.2);
const RING_DUST_GEOMETRY_HIGH = buildRingDustGeometry(140, 8, 12, 1.5);

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
  const sprite = getSpriteTexture();

  // Solid core "planet" -- stays a flat-shaded sphere so the node has a
  // clear clickable center, dust particles only decorate around it.
  const core = new THREE.Mesh(CORE_GEOMETRY, new THREE.MeshBasicMaterial({ color: displayColor }));
  group.add(core);

  // Glowing dust shell around the core.
  const glowDust = new THREE.Points(
    GLOW_DUST_GEOMETRY,
    new THREE.PointsMaterial({
      color: displayColor,
      size: node.isSelected ? 1.6 : 1.1,
      map: sprite,
      transparent: true,
      opacity: node.isSelected ? 0.9 : 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  group.add(glowDust);

  // Dust ring, only for medium/high fan-in tiers -- same thresholds as the
  // 2D impact halo in GraphNode.tsx.
  const tier = getImpactTier(node.importCount);
  if (tier !== "none") {
    const ringColor = tier === "high" ? IMPACT_TINT_HIGH : IMPACT_TINT_MEDIUM;
    const ringGeometry = tier === "high" ? RING_DUST_GEOMETRY_HIGH : RING_DUST_GEOMETRY_MEDIUM;
    const ringDust = new THREE.Points(
      ringGeometry,
      new THREE.PointsMaterial({
        color: ringColor,
        size: tier === "high" ? 1.4 : 1.0,
        map: sprite,
        transparent: true,
        opacity: tier === "high" ? 0.95 : 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    // Tilt like Saturn's rings so it reads as a ring from most camera
    // angles instead of vanishing edge-on when viewed top-down.
    ringDust.rotation.x = Math.PI / 2.6;
    group.add(ringDust);
  }

  // Impact-count number sprite -- a billboard (always faces camera) placed
  // at the node center, hidden by default and revealed by onBeforeRender
  // once the camera is close enough (see NUMBER_VISIBLE_DISTANCE). This
  // runs every frame Three.js renders this sprite, no manual render-loop
  // wiring needed.
  const numberSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getNumberTexture(node.importCount),
      transparent: true,
      depthTest: false, // always readable on top of the core sphere
      depthWrite: false,
    })
  );
  numberSprite.scale.set(6, 6, 1);
  numberSprite.renderOrder = 999;
  numberSprite.visible = false;
  numberSprite.onBeforeRender = (renderer, scene, camera) => {
    const worldPos = new THREE.Vector3();
    numberSprite.getWorldPosition(worldPos);
    const distance = camera.position.distanceTo(worldPos);
    numberSprite.visible = distance < NUMBER_VISIBLE_DISTANCE;
  };
  group.add(numberSprite);

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
