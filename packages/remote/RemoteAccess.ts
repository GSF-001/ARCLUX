// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface RemoteAccess {
  id: string;
  source?: string;
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export function createRemoteAccess(source?: string, allowedHosts: string[] = []): RemoteAccess {
  if (!source) return { id: crypto.randomUUID(), source, allowed: false, reason: "A source is required." };
  try {
    const host = new URL(source).hostname;
    const allowed = allowedHosts.length === 0 || allowedHosts.includes(host);
    return {
      id: crypto.randomUUID(),
      source,
      allowed,
      reason: allowed ? undefined : `Remote host is not allowed: ${host}`,
    };
  } catch {
    return { id: crypto.randomUUID(), source, allowed: false, reason: "Source is not a valid URL." };
  }
}
