// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { GlobalSearch } from "@/components/search/GlobalSearch";

interface SearchPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function SearchPage({ params }: SearchPageProps) {
  const { org, repo } = await params;
  const repoUrl = `https://github.com/${org}/${repo}.git`;

  return (
    <div className="p-8 text-neutral-200">
      <h1 className="text-lg font-semibold">
        Search — {org}/{repo}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Fuzzy-matches module paths and export names (packages/search engine, issue #9).
      </p>
      <div className="mt-4 max-w-xl">
        <GlobalSearch repoUrl={repoUrl} />
      </div>
    </div>
  );
}
