// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { ActivityView } from "@/components/activity/ActivityView";

interface ActivityPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { org, repo } = await params;
  const repoUrl = `https://github.com/${org}/${repo}.git`;

  return (
    <div className="h-full overflow-auto p-8 text-neutral-200">
      <ActivityView org={org} repo={repo} repoUrl={repoUrl} />
    </div>
  );
}
