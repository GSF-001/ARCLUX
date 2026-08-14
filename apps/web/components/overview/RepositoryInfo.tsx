// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

export interface RepositoryInfoProps {
  moduleCount: number;
  nodeCount: number;
  edgeCount: number;
  frameworks: string[];
  packageManager: string;
  dependencyCount: number;
  analyzedAt: string;
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="glass-card rounded-lg px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-lg text-foreground">{value}</p>
    </div>
  );
}

/**
 * Overview-page stat strip: module/node/edge counts, detected frameworks,
 * package manager, manifest dependencies, analysis timestamp. Pure
 * presentational — fed by RepositoryOverview from the /api/analyze
 * response.
 */
export function RepositoryInfo({
  moduleCount,
  nodeCount,
  edgeCount,
  frameworks,
  packageManager,
  dependencyCount,
  analyzedAt,
}: RepositoryInfoProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      <StatCard label="Modules" value={String(moduleCount)} />
      <StatCard label="Graph nodes" value={String(nodeCount)} />
      <StatCard label="Graph edges" value={String(edgeCount)} />
      <StatCard label="Frameworks" value={frameworks.length > 0 ? frameworks.join(", ") : "—"} />
      <StatCard label="Package manager" value={packageManager} />
      <StatCard label="Dependencies" value={String(dependencyCount)} />
      <div className="col-span-2 flex items-end">
        <p className="text-xs text-neutral-600">
          Analyzed {new Date(analyzedAt).toLocaleString()}
        </p>
      </div>
    </section>
  );
}
