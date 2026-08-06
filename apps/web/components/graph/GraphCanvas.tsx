// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useEffect, useRef, useCallback } from "react";
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

interface SimNode extends SimulationNodeDatum {
  id: string;
}

const DOUBLE_CLICK_DELAY_MS = 300;
const ZOOM_TO_NODE_SCALE = 2;

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
    isPanning.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent) {
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

  function handlePointerUp() {
    if (isPanning.current) {
      // Commit the DOM-only value to React state exactly once, at the end
      // of the drag, instead of on every pointermove.
      setTransform(liveTransform.current);
    }
    isPanning.current = false;
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, scale: Math.min(3, Math.max(0.2, t.scale * delta)) }));
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
        Analyzing repository…
      </div>
    );
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-black"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
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
              />
            );
          })}

          {graph.nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            return (
              <GraphNode
                key={node.id}
                node={node}
                position={pos}
                isSelected={node.id === selectedNodeId}
                isHovered={node.id === hoveredNodeId}
                onClick={selectNode}
                onHoverChange={setHoveredNodeId}
                importCount={importCounts.get(node.id) ?? 0}
                zoomScale={transform.scale}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
