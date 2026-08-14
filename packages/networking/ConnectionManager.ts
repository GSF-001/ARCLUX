// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tracks connection state to registered endpoints (packages/networking/NetworkRegistry.ts).
// A GET /analysis probe is used for liveness -- same route apps/vscode-extension
// already calls via daemonClient.ts, and packages/daemon/LocalBridgeServer.ts
// already exposes it, so no new server-side route needed.

import * as http from "http";
import type { ServiceEndpoint } from "./ServiceEndpoint";

export type ConnectionState = "connected" | "unreachable";

export async function checkConnection(endpoint: ServiceEndpoint, timeoutMs = 2000): Promise<ConnectionState> {
  return new Promise((resolve) => {
    const req = http.get(`${endpoint.baseUrl}/analysis`, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500 ? "connected" : "unreachable");
    });
    req.on("timeout", () => { req.destroy(); resolve("unreachable"); });
    req.on("error", () => resolve("unreachable"));
  });
}

/** Checks every registered endpoint's liveness in parallel. */
export async function checkAllConnections(
  registered: Array<{ daemonId: string; endpoint: ServiceEndpoint }>
): Promise<Map<string, ConnectionState>> {
  const results = new Map<string, ConnectionState>();
  await Promise.all(
    registered.map(async (r) => {
      results.set(r.daemonId, await checkConnection(r.endpoint));
    })
  );
  return results;
}
