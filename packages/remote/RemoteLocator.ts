// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface RemoteLocator {
  id: string;
  source?: string;
  protocol?: string;
  host?: string;
  path?: string;
  revision?: string;
  metadata?: Record<string, unknown>;
}

export function createRemoteLocator(source?: string, revision?: string): RemoteLocator {
  if (!source) return { id: crypto.randomUUID(), source, revision };
  try {
    const url = new URL(source);
    return { id: crypto.randomUUID(), source, revision, protocol: url.protocol, host: url.hostname, path: url.pathname };
  } catch {
    return { id: crypto.randomUUID(), source, revision, path: source };
  }
}
