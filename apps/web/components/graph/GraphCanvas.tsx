// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";
import { AnalyzingProgress } from "./AnalyzingProgress";

import { useEffect, useRef, useCallback, useMemo } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import { useGraphContext } from "./GraphProvider";
import { GraphNode, type GraphNodePosition } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface SimNode extends SimulationNodeDatum {
  id: string;
}

const DOUBLE_CLICK_DELAY_MS = 300;
const ZOOM_TO_NODE_SCALE = 2;
// Touch hit target for node dots (Apple HIG minimum). The invisible circle
// is only rendered on coarse pointers; see GraphNode hitRadius prop.
const NODE_HIT_RADIUS = 22;
// World-space margin around the visible viewport kept in the render pass so
// nodes/edges partially entering the frame don't pop out one frame early.
const CULL_MARGIN = 100;

interface PointerPoint {
  x: number;
  y: number;
}

interface PinchState {
  startDistance: number;
  startScale: number;
  startMidX: number;
  startMidY: number;
  startTx: number;
  startTy: number;
}

export function GraphCanvas() {
  const {
    graph,
    isLoading,
    error,
    selectedNodeId,
    selectNode,
    hoveredNodeId,
    setHoveredNodeId,
    transform,
    setTransform,
    setContextMenuNodeId,
    positions,
    setPositions,
    dimensions,
    setDimensions,
    importCounts,
  } = useGraphContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const graphGroupRef = useRef<SVGGElement>(null);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const clickTimer = useRef<number | null>(null);
  // Mirrors `transform` state but is mutated directly during a drag,
  // bypassing React entirely, so panning never re-renders graph.nodes /
  // graph.edges (hundreds of SVG elements) on every pointermove. State is
  // only committed once, on pointerup, via setTransform.
  const liveTransform = useRef(transform);
  // Active pointers (id -> position). Size 2 = pinch; the transition from
  // 1 to 2 cancels the single-finger pan so the two gestures never fight.
  const pointers = useRef(new Map<number, PointerPoint>());
  // Snapshot taken when the second finger lands; updated scale/translation
  // are derived from it on every move (zoom-to-midpoint, not viewport-center
  // zoom — the content stays under the fingers).
  const pinchStart = useRef<PinchState | null>(null);
  // Coarse pointer (touch) devices get the larger node hit target; mouse
  // keeps precise 6px targeting on dense graphs.
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");

  // When a node is selected or hovered, everything NOT connected to it
  // fades out (low opacity) so the active subgraph reads instantly — the
  // connected edges/nodes keep full strength. Computed once per active
  // node (memoized), not per node/edge, so a pan/zoom re-render stays cheap.
  const activeNodeId = selectedNodeId ?? hoveredNodeId;
  const connectedNodeIds = useMemo(() => {
    if (!activeNodeId || !graph) return null;
    const ids = new Set<string>([activeNodeId]);
    for (const e of graph.edges) {
      if (e.source === activeNodeId) ids.add(e.target);
      if (e.target === activeNodeId) ids.add(e.source);
    }
    return ids;
  }, [activeNodeId, graph]);

  useEffect(() => {
    liveTransform.current = transform;
  }, [transform]);

  function applyTransformToDOM(t: typeof transform) {
    graphGroupRef.current?.setAttribute("transform", `translate(${t.x}, ${t.y}) scale(${t.scale})`);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setDimensions]);

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;

    const simNodes: SimNode[] = graph.nodes.map((n) => ({ id: n.id }));
    const simLinks = graph.edges.map((e) => ({ source: e.source, target: e.target }));

    const simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink(simLinks)
          .id((d: SimulationNodeDatum) => (d as SimNode).id)
          .distance(60)
      )
      .force("charge", forceManyBody().strength(-120))
      // Fixed virtual center, NOT dimensions.width/height. The simulation's
      // coordinate space is independent of the actual container size —
      // panning/zooming (via `transform`) is what maps simulation space to
      // screen space. Using a fixed center means resizing the container
      // (e.g. a side panel opening/closing) never needs to re-run this
      // effect, since dimensions is no longer a dependency below.
      .force("center", forceCenter(500, 500))
      .force("collide", forceCollide(14))
      .stop();

    const maxTicks = Math.min(300, Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())));
    for (let i = 0; i < maxTicks; i++) simulation.tick();

    const nextPositions = new Map<string, GraphNodePosition>();
    for (const n of simNodes) {
      nextPositions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    }
    setPositions(nextPositions);
    // dimensions intentionally NOT a dependency anymore — see the
    // forceCenter comment above. Previously this effect re-ran (and reset
    // ALL node positions from scratch) any time the container resized,
    // e.g. a side panel opening/closing. Re-centering the VIEWPORT on
    // resize is a separate, not-yet-implemented concern that should adjust
    // `transform`, not re-run the simulation.
  }, [graph, setPositions]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") selectNode(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectNode]);

  const getNodeIdFromEvent = useCallback((target: EventTarget | null): string | undefined => {
    if (!(target instanceof Element)) return undefined;
    return target.closest<SVGElement>("[data-node-id]")?.dataset.nodeId;
  }, []);

  function zoomToNode(nodeId: string) {
    const pos = positions.get(nodeId);
    if (!pos) return;
    setTransform({
      x: dimensions.width / 2 - pos.x * ZOOM_TO_NODE_SCALE,
      y: dimensions.height / 2 - pos.y * ZOOM_TO_NODE_SCALE,
      scale: ZOOM_TO_NODE_SCALE,
    });
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const nodeId = getNodeIdFromEvent(e.target);

    if (!nodeId) {
      selectNode(null);
      return;
    }

    if (clickTimer.current) {
      return;
    }

    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      selectNode(nodeId);
    }, DOUBLE_CLICK_DELAY_MS);
  }

  function handleSvgDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    const nodeId = getNodeIdFromEvent(e.target);
    if (!nodeId) return;

    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }

    selectNode(nodeId);
    zoomToNode(nodeId);
  }

  function handleSvgContextMenu(e: React.MouseEvent<SVGSVGElement>) {
    const nodeId = getNodeIdFromEvent(e.target);
    if (!nodeId) return;
    e.preventDefault();
    setContextMenuNodeId(nodeId);
  }

  function handlePointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      // Second finger down: switch from pan to pinch, anchored at the
      // current midpoint + scale so zoom keeps the content under the
      // fingers (zoom-to-point) instead of around the viewport center.
      const [p1, p2] = [...pointers.current.values()];
      pinchStart.current = {
        startDistance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        startScale: liveTransform.current.scale,
        startMidX: (p1.x + p2.x) / 2,
        startMidY: (p1.y + p2.y) / 2,
        startTx: liveTransform.current.x,
        startTy: liveTransform.current.y,
      };
      isPanning.current = false;
      return;
    }

    if (pointers.current.size === 1) {
      isPanning.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch: scale by the finger-distance ratio, translate so the midpoint
    // stays pinned to where the fingers were when the pinch started.
    if (pinchStart.current && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const scale = Math.min(3, Math.max(0.2, pinchStart.current.startScale * (distance / pinchStart.current.startDistance)));
      const k = scale / pinchStart.current.startScale;
      liveTransform.current = {
        scale,
        x: midX - k * (pinchStart.current.startMidX - pinchStart.current.startTx),
        y: midY - k * (pinchStart.current.startMidY - pinchStart.current.startTy),
      };
      applyTransformToDOM(liveTransform.current);
      return;
    }

    if (!isPanning.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    liveTransform.current = {
      ...liveTransform.current,
      x: liveTransform.current.x + dx,
      y: liveTransform.current.y + dy,
    };
    applyTransformToDOM(liveTransform.current);
  }

  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    // Lifting one finger out of a pinch falls back to one-finger pan.
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      if (isPanning.current) {
        // Commit the DOM-only value to React state exactly once, at the end
        // of the drag, instead of on every pointermove.
        setTransform(liveTransform.current);
      }
      isPanning.current = false;
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = containerRef.current?.getBoundingClientRect();
    // Zoom toward the CURSOR: keep the world point under the pointer fixed
    // on screen. The old code scaled around the top-left transform anchor,
    // so the view drifted up-left on every wheel step (user: "it zooms
    // somewhere above"). Touch pinch already zooms around the fingers'
    // midpoint, so this only affects mouse wheel.
    if (!rect) {
      setTransform((t) => ({ ...t, scale: Math.min(3, Math.max(0.2, t.scale * delta)) }));
      return;
    }
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    setTransform((t) => {
      const newScale = Math.min(3, Math.max(0.2, t.scale * delta));
      const worldX = (cursorX - t.x) / t.scale;
      const worldY = (cursorY - t.y) / t.scale;
      return {
        scale: newScale,
        x: cursorX - worldX * newScale,
        y: cursorY - worldY * newScale,
      };
    });
  }

  if (isLoading) {
    return <AnalyzingProgress />;
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
        No nodes to display.
      </div>
    );
  }

  // Viewport culling: only render nodes/edges intersecting the visible
  // world-space rectangle (plus CULL_MARGIN), so zoomed-in views of large
  // graphs stop re-rendering hundreds of off-screen SVG elements. The
  // selected/hovered node always renders regardless of visibility.
  const margin = CULL_MARGIN / transform.scale;
  const viewLeft = -transform.x / transform.scale - margin;
  const viewTop = -transform.y / transform.scale - margin;
  const viewRight = (dimensions.width - transform.x) / transform.scale + margin;
  const viewBottom = (dimensions.height - transform.y) / transform.scale + margin;
  const isInView = (pos: GraphNodePosition) =>
    pos.x >= viewLeft && pos.x <= viewRight && pos.y >= viewTop && pos.y <= viewBottom;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-black"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      onWheel={handleWheel}
    >
      <svg
        width="100%"
        height="100%"
        onClick={handleSvgClick}
        onDoubleClick={handleSvgDoubleClick}
        onContextMenu={handleSvgContextMenu}
      >
        <defs>
          {[
            ["import", "#E5E5E5"],
            ["export", "#C9A6F5"],
            ["call", "#8FC4FF"],
            ["route-link", "#8FE8D8"],
          ].map(([type, fillColor]) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill={fillColor} />
            </marker>
          ))}
        </defs>
        <g ref={graphGroupRef} transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {graph.edges.map((edge) => {
            const sourcePos = positions.get(edge.source);
            const targetPos = positions.get(edge.target);
            if (!sourcePos || !targetPos) return null;
            const isHighlighted =
              edge.source === selectedNodeId ||
              edge.target === selectedNodeId ||
              edge.source === hoveredNodeId ||
              edge.target === hoveredNodeId;
            // Cull edges with BOTH endpoints off-screen (an edge touching a
            // visible node must render, even if its other end is outside).
            if (!isHighlighted && !isInView(sourcePos) && !isInView(targetPos)) return null;
            // Label only shows for the SELECTED node's edges, not hover —
            // hovering a high fan-in hub was popping dozens of overlapping
            // "imports" labels at once (see live dogfood screenshot).
            // GraphFocusView already lists all connections cleanly on
            // click, so the canvas label no longer needs to fire on hover
            // too.
            return (
              <GraphEdge
                key={edge.id}
                edge={edge}
                sourcePos={sourcePos}
                targetPos={targetPos}
                isHighlighted={isHighlighted}
                isDimmed={connectedNodeIds !== null && !isHighlighted}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const isSelected = node.id === selectedNodeId;
            const isHovered = node.id === hoveredNodeId;
            // Cull off-screen nodes (selected/hovered always stay mounted
            // so interaction never drops them mid-gesture).
            if (!isSelected && !isHovered && !isInView(pos)) return null;
            return (
              <GraphNode
                key={node.id}
                node={node}
                position={pos}
                isSelected={isSelected}
                isHovered={isHovered}
                onClick={selectNode}
                onHoverChange={setHoveredNodeId}
                importCount={importCounts.get(node.id) ?? 0}
                zoomScale={transform.scale}
                hitRadius={isCoarsePointer ? NODE_HIT_RADIUS : undefined}
                isDimmed={connectedNodeIds !== null && !isSelected && !isHovered && !connectedNodeIds.has(node.id)}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
