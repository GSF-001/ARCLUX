// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { RepositoryOverview } from "@/components/overview/RepositoryOverview";

interface OverviewPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function OverviewPage({ params }: OverviewPageProps) {
  const { org, repo } = await params;

  return (
    <main className="h-screen w-full bg-background text-foreground">
      <RepositoryOverview org={org} repo={repo} />
    </main>
  );
}
