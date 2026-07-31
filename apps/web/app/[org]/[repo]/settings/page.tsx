// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

interface SettingsPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { org, repo } = await params;

  return (
    <div className="p-8 text-neutral-200">
      <h1 className="text-lg font-semibold">
        Settings — {org}/{repo}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Repository settings coming soon.
      </p>
    </div>
  );
}
