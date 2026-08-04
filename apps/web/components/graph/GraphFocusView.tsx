// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Requested after the force-graph canvas became unreadable on high-fan-in
// nodes (see GraphEdge.tsx's own comment: hovering a hub with 30+ incoming
// edges pops that many "imports" labels at once, all overlapping). This is
// a different interaction entirely, not a fix to that overlap — instead of
// labels floating on the physics-simulated canvas, selecting a node opens
// this fixed two-column panel: labeled cards (name + path) grouped by
// direction, no overlapping text regardless of fan-in count.
//
// Closing this panel (closeFocusPanel) is deliberately separate from
// deselecting the node (selectNode(null)): the panel can hide while the
// node stays highlighted in GraphCanvas.

"use client";

import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { useGraphContext } from "./GraphProvider";
import { getGraphNodeColor } from "@/theme/graphColors";
import { getNodeIconPath } from "./nodeIcons";
import type { GraphNode as GraphNodeData } from "@/packages/shared/types";

const MAX_CARDS_PER_SIDE = 12;

function NodeIcon({ node, size = 16 }: { node: GraphNodeData; size?: number }) {
  const color = getGraphNodeColor(node.type, "dark");
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" className="shrink-0">
      <circle r={7} fill={color} opacity={0.9} />
      <path
        d={getNodeIconPath(node.type)}
        fill="none"
        stroke="#fff"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NodeCard({ node, onClick }: { node: GraphNodeData; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-900"
    >
      <NodeIcon node={node} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-100">{node.label}</p>
        {node.filePath && (
          <p className="truncate font-mono text-[11px] text-neutral-500">{node.filePath}</p>
        )}
      </div>
    </button>
  );
}

export function GraphFocusView() {
  const { graph, selectedNodeId, selectNode, isFocusPanelOpen, closeFocusPanel } = useGraphContext();

  const node = graph?.nodes.find((n) => n.id === selectedNodeId);
  if (!node || !graph || !isFocusPanelOpen) return null;

  const dependencies = graph.edges
    .filter((e) => e.source === node.id)
    .map((e) => graph.nodes.find((n) => n.id === e.target))
    .filter((n): n is GraphNodeData => Boolean(n));

  const dependents = graph.edges
    .filter((e) => e.target === node.id)
    .map((e) => graph.nodes.find((n) => n.id === e.source))
    .filter((n): n is GraphNodeData => Boolean(n));

  return (
    <div className="absolute inset-4 z-20 flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <NodeIcon node={node} size={20} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-100">{node.label}</p>
            {node.filePath && (
              <p className="truncate font-mono text-xs text-neutral-500">{node.filePath}</p>
            )}
          </div>
        </div>
        <button
          onClick={closeFocusPanel}
          aria-label="Close focus view"
          className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid flex-1 grid-cols-2 divide-x divide-neutral-800 overflow-hidden">
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-400">
            <ArrowLeft className="h-3 w-3" />
            Depends on ({dependencies.length})
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {dependencies.length === 0 && (
              <p className="px-1 text-xs text-neutral-600">No outgoing dependencies.</p>
            )}
            {dependencies.slice(0, MAX_CARDS_PER_SIDE).map((dep) => (
              <NodeCard key={dep.id} node={dep} onClick={() => selectNode(dep.id)} />
            ))}
            {dependencies.length > MAX_CARDS_PER_SIDE && (
              <p className="px-1 pt-1 text-xs text-neutral-600">
                +{dependencies.length - MAX_CARDS_PER_SIDE} more
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-end gap-1.5 border-b border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-400">
            Used by ({dependents.length})
            <ArrowRight className="h-3 w-3" />
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {dependents.length === 0 && (
              <p className="px-1 text-xs text-neutral-600">Nothing imports this file.</p>
            )}
            {dependents.slice(0, MAX_CARDS_PER_SIDE).map((dep) => (
              <NodeCard key={dep.id} node={dep} onClick={() => selectNode(dep.id)} />
            ))}
            {dependents.length > MAX_CARDS_PER_SIDE && (
              <p className="px-1 pt-1 text-xs text-neutral-600">
                +{dependents.length - MAX_CARDS_PER_SIDE} more
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
