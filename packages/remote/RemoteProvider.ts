// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface RemoteProvider {
  id: string;
  source?: string;
  name: "github" | "gitlab" | "archive" | "local" | "unknown";
  supports(source: string): boolean;
  metadata?: Record<string, unknown>;
}

export function createRemoteProvider(source?: string): RemoteProvider {
  const name = identifyProvider(source);
  return {
    id: crypto.randomUUID(),
    source,
    name,
    supports: (candidate) => identifyProvider(candidate) === name,
  };
}

function identifyProvider(source?: string): RemoteProvider["name"] {
  if (!source) return "unknown";
  if (/github\.com/i.test(source)) return "github";
  if (/gitlab\.com/i.test(source)) return "gitlab";
  if (/\.(?:zip|tar|tar\.gz|tgz)(?:$|\?)/i.test(source)) return "archive";
  if (!/^\w+:\/\//.test(source)) return "local";
  return "unknown";
}
