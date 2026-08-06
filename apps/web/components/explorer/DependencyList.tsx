"use client";

import { useEffect, useState } from "react";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { EmptyState } from "@/components/patterns/EmptyState";
import { fetchGraph } from "@/lib/graph";
import type { DependencyGraph, GraphNode } from "@/packages/shared/types";

// Verified against app/api/graph/route.ts: DependencyGraph.nodes/edges
// match GraphNode/GraphEdge exactly. The local GraphResponse type that
// used to live here (a guess made before this was confirmed) is gone --
// this now imports the real shared types via lib/graph.ts's fetchGraph().

export interface DependencyListProps {
  repoUrl: string;
  moduleId: string;
  branch?: string;
}

/**
 * STATUS: belum ada consumer (grep Explorer.tsx kosong saat file ini
 * ditulis) -- desain prop & asumsi query param /api/graph
 * (?repoUrl=&branch=, ngikutin pola /api/file dan /api/impact) BELUM
 * dikonfirmasi terhadap app/api/graph/route.ts yang sebenarnya. Cek dulu
 * sebelum percaya ini jalan tanpa modifikasi.
 *
 * Fetch graph penuh lalu filter client-side (bukan endpoint khusus
 * dependency) -- konsisten sama pola GraphProvider.tsx yang udah ada
 * (importCounts dihitung client-side dari graph.edges, bukan lewat API
 * baru). Kalau Explorer ini nanti dirender di dalam tree yang sama
 * dengan GraphProvider, fetch ini jadi redundant -- pertimbangkan ganti
 * ke useGraphContext() saat itu terjadi, jangan biarin 2 sumber data
 * graph yang beda hidup berdampingan.
 */
export function DependencyList({ repoUrl, moduleId, branch }: DependencyListProps) {
  const [data, setData] = useState<DependencyGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const graph = await fetchGraph(repoUrl, branch);
        if (!cancelled) setData(graph);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dependencies");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [repoUrl, branch]);

  if (isLoading) return <LoadingState label="Loading dependencies..." />;
  if (error) return <ErrorState title="Couldn't load dependencies" message={error} />;
  if (!data) return null;

  const nodesById = new Map(data.nodes.map((n) => [n.id, n]));

  const imports = data.edges
    .filter((e) => e.type === "import" && e.source === moduleId)
    .map((e) => nodesById.get(e.target))
    .filter((n): n is GraphNode => Boolean(n));

  const importedBy = data.edges
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
