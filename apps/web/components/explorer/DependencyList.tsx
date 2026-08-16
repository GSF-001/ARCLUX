"use client";

import { useGraphContext } from "@/components/graph/GraphProvider";
import { LoadingState } from "@/components/patterns/LoadingState";
import { EmptyState } from "@/components/patterns/EmptyState";
import type { GraphNode } from "@/packages/shared/types";

export interface DependencyListProps {
  repoUrl: string;
  moduleId: string;
  branch?: string;
}

/**
 * Incoming/outgoing dependency lists for a module, read from the graph
 * ALREADY loaded by GraphProvider — no network call of its own.
 *
 * This used to `fetchGraph()` (/api/graph), but that endpoint re-clones
 * and re-indexes the ENTIRE repository on every call (no caching, same
 * cost as /api/analyze). Explorer renders inside GraphProvider's tree
 * (ExplorerPanel is a child of GraphViewport), so the full
 * DependencyGraph is already in context by the time a node is clicked —
 * re-fetching it would double the clone cost for zero new information.
 * The leftover `repoUrl`/`branch` props are kept for interface stability
 * (Explorer passes them through); they are not used here anymore.
 */
export function DependencyList({ moduleId }: DependencyListProps) {
  const { graph } = useGraphContext();
  if (!graph) return <LoadingState label="Loading dependencies..." />;

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  const imports = graph.edges
    .filter((e) => e.type === "import" && e.source === moduleId)
    .map((e) => nodesById.get(e.target))
    .filter((n): n is GraphNode => Boolean(n));

  const importedBy = graph.edges
    .filter((e) => e.type === "import" && e.target === moduleId)
    .map((e) => nodesById.get(e.source))
    .filter((n): n is GraphNode => Boolean(n));

  return (
    <div className="space-y-6 p-4">
      <DependencySection title="Imports" nodes={imports} emptyMessage="This module doesn't import anything internal." />
      <DependencySection title="Imported by" nodes={importedBy} emptyMessage="Nothing imports this module." />
    </div>
  );
}

function DependencySection({
  title,
  nodes,
  emptyMessage,
}: {
  title: string;
  nodes: GraphNode[];
  emptyMessage: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{nodes.length}</span>
      </div>
      {nodes.length === 0 ? (
        <EmptyState title="" message={emptyMessage} />
      ) : (
        <div className="space-y-1">
          {nodes.map((n) => (
            <div key={n.id} className="rounded-md px-2 py-1.5 hover:bg-muted/30">
              <p className="truncate text-sm font-medium">{n.label}</p>
              {n.filePath && <p className="truncate text-xs text-muted-foreground">{n.filePath}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
