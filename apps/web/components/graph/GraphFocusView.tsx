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
//
// Labels rewritten from graph-theory terms ("Depends on" / "Used by") to
// consequence-framed language ("This file needs" / "If you change this,
// it affects"), plus a color split (neutral for what this file needs,
// warm/red for what breaks if this file changes) — dogfooding feedback
// was that the two columns read as visually identical and required
// stopping to think about which side was which.

"use client";

import { X, ArrowLeft, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useGraphContext } from "./GraphProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getGraphNodeColor } from "@/theme/graphColors";
import { getNodeIconPath } from "./nodeIcons";
import { getEffectiveNodeType } from "./GraphNode";
import type { GraphNode as GraphNodeData } from "@/packages/shared/types";

// Reuses the existing "hook" node color (#E06C75 dark) as the impact/
// warning accent, rather than introducing a new color not in
// theme/graphColors.ts's palette.
const IMPACT_COLOR = "#E06C75";
const INITIAL_VISIBLE = 30;

function NodeIcon({ node, size = 16 }: { node: GraphNodeData; size?: number }) {
  // Same effective-type classification as the canvas (GraphNode.tsx): the
  // pipeline emits everything as "file", so without this every card icon
  // would render in the single file-blue even though the canvas is colored.
  const type = getEffectiveNodeType(node);
  const color = getGraphNodeColor(type, "dark");
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" className="shrink-0">
      <circle r={7} fill={color} opacity={0.9} />
      <path
        d={getNodeIconPath(type, node.label)}
        fill="none"
        stroke="#fff"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NodeCard({
  node,
  onClick,
  accent = false,
}: {
  node: GraphNodeData;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
        accent
          ? "bg-red-950/15 hover:bg-red-950/25"
          : "bg-neutral-900/60 hover:bg-neutral-800/80"
      }`}
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
  const { graph, selectedNodeId, selectNode, isFocusPanelOpen, closeFocusPanel, goBackFocus, canGoBack } = useGraphContext();

  const [depsExpanded, setDepsExpanded] = useState(false);
  const [dependentsExpanded, setDependentsExpanded] = useState(false);
  // Manual collapse toggle (persists across node changes): lets the user
  // tuck the panel away and navigate the map by clicking nodes, following
  // the highlighted connections — see the collapsible button on the panel's
  // right edge. Reset when the panel fully closes (deselect).
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Mirrors ExplorerPanel's breakpoint: the right drawer is full-width on
  // mobile (backdrop covers the canvas), 480px (md:w-120) on md+ — only the
  // latter needs the panel to shift left.
  const isMdUp = useMediaQuery("(min-width: 48rem)");

  // Collapse both sides again whenever the focused node changes, so
  // navigating to a new file (via a card click or the back button)
  // doesn't carry over a previous file's "show all" state.
  // React-recommended replacement for a setState-in-effect: adjust state
  // during render, keyed on the previous prop value.
  const [prevSelectedNodeId, setPrevSelectedNodeId] = useState(selectedNodeId);
  if (prevSelectedNodeId !== selectedNodeId) {
    setPrevSelectedNodeId(selectedNodeId);
    setDepsExpanded(false);
    setDependentsExpanded(false);
  }

  const node = graph?.nodes.find((n) => n.id === selectedNodeId);
  if (!node || !graph || !isFocusPanelOpen) return null;

  // Coexists with the right-side Code Drawer (GraphViewport.tsx): "file"-type
  // nodes open the drawer (File/Dependencies/Impact tabs) AND this central
  // panel. On md+ the panel shifts left of the drawer's 480px (md:w-120)
  // width (right-[31rem] = 30rem drawer + 1rem gap) so the two never overlap
  // — the old pre-172d7d0 clipping bug is fixed by LAYOUT, not by hiding one
  // surface. On mobile the drawer is full-width behind a backdrop, so the
  // panel stays at its normal inset. Non-file nodes (folders, external
  // packages) have no drawer and use the full-width inset.
  const drawerIsOpen = node.type === "file" && isMdUp;

  // Collapse/expand toggle. While the panel is OPEN it is pinned to the
  // panel's right edge (vertically centered, half-outside via
  // translate-x-full). When COLLAPSED the panel is gone, so the button
  // slides LEFT to the canvas's left edge (left-4) instead of floating on
  // the right — the user's explicit ask ("should move left after closing").
  // Chevron follows the direction of the next action: collapse → left,
  // expand → right.
  const collapseButton = (
    <button
      type="button"
      onClick={() => setIsCollapsed((v) => !v)}
      aria-label={isCollapsed ? "Expand dependency panel" : "Collapse dependency panel"}
      className={`absolute top-1/2 z-30 flex h-16 w-6 -translate-y-1/2 items-center justify-center bg-neutral-900/85 text-neutral-400 transition-all hover:bg-neutral-800 hover:text-neutral-200 ${
        isCollapsed
          ? "left-4 rounded-r-md border border-l-0"
          : `translate-x-full rounded-r-md border border-l-0 ${
              drawerIsOpen ? "right-[31rem]" : "right-4"
            }`
      }`}
    >
      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
    </button>
  );

  if (isCollapsed) return <>{collapseButton}</>;

  const dependencies = graph.edges
    .filter((e) => e.source === node.id)
    .map((e) => graph.nodes.find((n) => n.id === e.target))
    .filter((n): n is GraphNodeData => Boolean(n));

  const dependents = graph.edges
    .filter((e) => e.target === node.id)
    .map((e) => graph.nodes.find((n) => n.id === e.source))
    .filter((n): n is GraphNodeData => Boolean(n));

  return (
    <>
      <div
        className={`glass-panel absolute top-4 bottom-4 left-4 z-20 flex flex-col overflow-hidden rounded-lg ${
          drawerIsOpen ? "right-[31rem]" : "right-4"
        }`}
      >
      <div className="flex items-center justify-between bg-neutral-900/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {canGoBack && (
            <button
              onClick={goBackFocus}
              aria-label="Back to previous file"
              className="shrink-0 rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
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

      <div className="grid flex-1 grid-cols-2 gap-px overflow-hidden bg-neutral-900/40">
        <div className="flex flex-col overflow-hidden">
          <div className="flex flex-col gap-0.5 bg-neutral-900/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              This file needs ({dependencies.length})
            </div>
            <p className="text-[10px] text-neutral-600">Files {node.label} imports</p>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {dependencies.length === 0 && (
              <p className="px-1 text-xs text-neutral-600">No outgoing dependencies.</p>
            )}
            {(depsExpanded ? dependencies : dependencies.slice(0, INITIAL_VISIBLE)).map((dep) => (
              <NodeCard key={dep.id} node={dep} onClick={() => selectNode(dep.id)} />
            ))}
            {!depsExpanded && dependencies.length > INITIAL_VISIBLE && (
              <button
                onClick={() => setDepsExpanded(true)}
                className="w-full px-1 pt-1 text-left text-xs text-neutral-400 hover:text-neutral-200 hover:underline"
              >
                +{dependencies.length - INITIAL_VISIBLE} more
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden">
          <div className="flex flex-col gap-0.5 bg-red-950/10 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: IMPACT_COLOR }}>
              <AlertTriangle className="h-3 w-3" />
              If you change this, it affects ({dependents.length})
            </div>
            <p className="text-[10px] text-neutral-600">Files that import {node.label}</p>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {dependents.length === 0 && (
              <p className="px-1 text-xs text-neutral-600">Nothing imports this file.</p>
            )}
            {(dependentsExpanded ? dependents : dependents.slice(0, INITIAL_VISIBLE)).map((dep) => (
              <NodeCard key={dep.id} node={dep} onClick={() => selectNode(dep.id)} accent />
            ))}
            {!dependentsExpanded && dependents.length > INITIAL_VISIBLE && (
              <button
                onClick={() => setDependentsExpanded(true)}
                className="w-full px-1 pt-1 text-left text-xs hover:underline"
                style={{ color: IMPACT_COLOR }}
              >
                +{dependents.length - INITIAL_VISIBLE} more
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
      {collapseButton}
    </>
  );
}
