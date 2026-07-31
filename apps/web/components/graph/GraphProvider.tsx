"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DependencyGraph, GraphNode as GraphNodeData } from "@/packages/shared/types";

interface GraphContextValue {
  graph: DependencyGraph | null;
  isLoading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchGraph() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ repoUrl });
        if (branch) params.set("branch", branch);

        const res = await fetch(`/api/graph?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? `Request failed with status ${res.status}`);
        }
        if (!cancelled) {
          setGraph(data as DependencyGraph);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load graph");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGraph();
    return () => {
      cancelled = true;
    };
  }, [repoUrl, branch]);

  const value: GraphContextValue = {
    graph,
    isLoading,
    error,
    selectedNodeId,
    selectNode: setSelectedNodeId,
    hoveredNodeId,
    setHoveredNodeId,
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
