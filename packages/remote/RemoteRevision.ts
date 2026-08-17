// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface RemoteRevision {
  id: string;
  source?: string;
  value?: string;
  immutable: boolean;
  metadata?: Record<string, unknown>;
}

export function createRemoteRevision(value?: string, source?: string): RemoteRevision {
  return {
    id: crypto.randomUUID(),
    source,
    value,
    immutable: value ? /^[0-9a-f]{7,64}$/i.test(value) : false,
  };
}
