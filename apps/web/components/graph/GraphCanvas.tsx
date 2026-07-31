"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  const { graph, isLoading, error, selectedNodeId, selectNode, hoveredNodeId, setHoveredNodeId } =
    useGraphContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, GraphNodePosition>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const clickTimer = useRef<number | null>(null);

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
  }, []);

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
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", forceCollide(14))
      .stop();

    const maxTicks = Math.min(300, Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())));
    for (let i = 0; i < maxTicks; i++) simulation.tick();

    const nextPositions = new Map<string, GraphNodePosition>();
    for (const n of simNodes) {
      nextPositions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    }
    setPositions(nextPositions);
  }, [graph, dimensions.width, dimensions.height]);

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

  function handlePointerDown(e: React.PointerEvent) {
    isPanning.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }

  function handlePointerUp() {
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
      <svg width="100%" height="100%" onClick={handleSvgClick} onDoubleClick={handleSvgDoubleClick}>
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {graph.edges.map((edge) => {
            const sourcePos = positions.get(edge.source);
            const targetPos = positions.get(edge.target);
            if (!sourcePos || !targetPos) return null;
            const isHighlighted =
              edge.source === selectedNodeId ||
              edge.target === selectedNodeId ||
              edge.source === hoveredNodeId ||
              edge.target === hoveredNodeId;
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
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
