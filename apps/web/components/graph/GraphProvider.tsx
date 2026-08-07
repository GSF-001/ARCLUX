// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
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
    setSelectedNodeId(id);
    setIsFocusPanelOpen(id !== null);
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
