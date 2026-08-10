// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { fetchGraph as fetchGraphData } from "@/lib/graph";
import type { DependencyGraph, GraphNode as GraphNodeData } from "@/packages/shared/types";
import type { GraphNodePosition } from "./GraphNode";

export interface GraphTransform {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const DEFAULT_TRANSFORM: GraphTransform = { x: 0, y: 0, scale: 1 };
const DEFAULT_DIMENSIONS: CanvasDimensions = { width: 800, height: 600 };

interface GraphContextValue {
  graph: DependencyGraph | null;
  isLoading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;
  isFocusPanelOpen: boolean;
  closeFocusPanel: () => void;
  /** Stack of previously focused node ids, most recent last. Pushed to
   * whenever selectNode() switches to a DIFFERENT node while one was
   * already selected (navigating between focus cards), not on the
   * initial selection or on selectNode(null). */
  focusHistory: string[];
  /** Pops the last entry off focusHistory and selects it, without
   * re-pushing the node being navigated away from (that would make
   * back/forward loop instead of unwind). No-op if history is empty. */
  goBackFocus: () => void;
  canGoBack: boolean;
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  transform: GraphTransform;
  setTransform: (t: GraphTransform | ((prev: GraphTransform) => GraphTransform)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  contextMenuNodeId: string | null;
  setContextMenuNodeId: (id: string | null) => void;
  positions: Map<string, GraphNodePosition>;
  setPositions: (p: Map<string, GraphNodePosition>) => void;
  dimensions: CanvasDimensions;
  setDimensions: (d: CanvasDimensions) => void;
  /** Fan-in count per node id, computed from graph.edges (how many edges
   * target this node). Drives the impact halo in GraphNode.tsx -- see
   * progres/PROGRES-decisions.md for why this is computed client-side
   * instead of added to the backend GraphNode type. */
  importCounts: Map<string, number>;
}

const GraphContext = createContext<GraphContextValue | null>(null);

export interface GraphProviderProps {
  repoUrl: string;
  branch?: string;
  children: ReactNode;
}

export function GraphProvider({ repoUrl, branch, children }: GraphProviderProps) {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFocusPanelOpen, setIsFocusPanelOpen] = useState(false);
  const [focusHistory, setFocusHistory] = useState<string[]>([]);
  // Ref mirror of selectedNodeId so selectNode (a stable useCallback with
  // an empty dep array) can read the CURRENT value without needing
  // selectedNodeId in its deps -- avoids the callback identity changing on
  // every selection, which several children rely on being stable.
  const selectedNodeIdRef = useRef<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState<GraphTransform>(DEFAULT_TRANSFORM);
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, GraphNodePosition>>(new Map());
  const [dimensions, setDimensions] = useState<CanvasDimensions>(DEFAULT_DIMENSIONS);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchGraphData(repoUrl, branch);
        if (!cancelled) {
          setGraph(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load graph");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadGraph();
    return () => {
      cancelled = true;
    };
  }, [repoUrl, branch]);

  // Selecting a node highlights it AND opens the focus panel. Closing the
  // panel (closeFocusPanel) does NOT clear selectedNodeId, so the graph
  // highlight survives the panel closing. Only selectNode(null) — clicking
  // empty canvas or Escape — clears both.
  const selectNode = useCallback((id: string | null) => {
    const prev = selectedNodeIdRef.current;
    if (id === null) {
      // Deselecting (empty canvas click / Escape) starts a fresh browsing
      // session -- old history no longer makes sense to "go back" into.
      setFocusHistory([]);
    } else if (prev !== null && prev !== id) {
      setFocusHistory((h) => [...h, prev]);
    }
    selectedNodeIdRef.current = id;
    setSelectedNodeId(id);
    setIsFocusPanelOpen(id !== null);
  }, []);

  const goBackFocus = useCallback(() => {
    setFocusHistory((h) => {
      if (h.length === 0) return h;
      const previousId = h[h.length - 1];
      selectedNodeIdRef.current = previousId;
      setSelectedNodeId(previousId);
      setIsFocusPanelOpen(true);
      return h.slice(0, -1);
    });
  }, []);

  const closeFocusPanel = useCallback(() => {
    setIsFocusPanelOpen(false);
  }, []);

  const zoomIn = useCallback(() => {
    setTransform((t) => ({ ...t, scale: Math.min(MAX_SCALE, t.scale * 1.2) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((t) => ({ ...t, scale: Math.max(MIN_SCALE, t.scale / 1.2) }));
  }, []);

  const resetView = useCallback(() => {
    setTransform(DEFAULT_TRANSFORM);
  }, []);

  const importCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!graph) return counts;
    for (const edge of graph.edges) {
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    return counts;
  }, [graph]);

  const value: GraphContextValue = {
    graph,
    isLoading,
    error,
    selectedNodeId,
    selectNode,
    isFocusPanelOpen,
    closeFocusPanel,
    focusHistory,
    goBackFocus,
    canGoBack: focusHistory.length > 0,
    hoveredNodeId,
    setHoveredNodeId,
    transform,
    setTransform,
    zoomIn,
    zoomOut,
    resetView,
    contextMenuNodeId,
    setContextMenuNodeId,
    positions,
    setPositions,
    dimensions,
    setDimensions,
    importCounts,
  };

  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
}

export function useGraphContext(): GraphContextValue {
  const ctx = useContext(GraphContext);
  if (!ctx) {
    throw new Error("useGraphContext must be used within a <GraphProvider>");
  }
  return ctx;
}

export type { GraphNodeData };
