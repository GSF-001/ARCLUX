"use client";

import { useEffect, useState } from "react";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { EmptyState } from "@/components/patterns/EmptyState";

// Response shape didefinisiin lokal, sama pola kayak FileDetails.tsx
// (FileResponse) dan ImpactSummary.tsx (ImpactResponse) -- bukan import
// dari packages/shared/types karena apps/web ke packages/ cross-boundary
// import path belum dikonfirmasi (workspace alias / relative path belum
// dicek). Kalau nanti ada @arclux/shared alias, field-field ini harus
// sama persis kayak GraphNode/GraphEdge di packages/shared/types.ts.
interface GraphNodeResponse {
  id: string;
  type: string;
  label: string;
  filePath?: string;
}

interface GraphEdgeResponse {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface GraphResponse {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
}

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
  const [data, setData] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ repoUrl });
        if (branch) params.set("branch", branch);

        const res = await fetch(`/api/graph?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error ?? `Request failed with status ${res.status}`);
        if (!cancelled) setData(json as GraphResponse);
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
    .filter((n): n is GraphNodeResponse => Boolean(n));

  const importedBy = data.edges
    .filter((e) => e.type === "import" && e.target === moduleId)
    .map((e) => nodesById.get(e.source))
    .filter((n): n is GraphNodeResponse => Boolean(n));

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
  nodes: GraphNodeResponse[];
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
