// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Regression tests for the daemon bridge fixes found by issue #347's
// runtime verification: GET /diagnostics was documented in the bridge's
// doc comment but 404'd (never implemented); detached spawn crashed on
// extensionless .ts imports (covered indirectly by the e2e — here we pin
// the /diagnostics behavior).

import { describe, it, expect, afterAll } from "vitest";
import { get as httpGet } from "node:http";
import { startLocalBridgeServer, type LocalBridgeServer } from "../packages/daemon/LocalBridgeServer";
import { Kernel } from "../packages/kernel/Kernel";
import { findFreePort } from "../packages/networking/PortManager";

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpGet(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

describe("LocalBridgeServer (issue #347 fixes)", () => {
  let server: LocalBridgeServer | null = null;

  afterAll(async () => {
    await server?.close();
  });

  it("GET /diagnostics is explicit before any run, serves the last run, and 404s unknown routes", async () => {
    const kernel = new Kernel();
    const fakeDaemon = {
      kernel,
      getAnalysis: async () => ({ moduleCount: 1, meta: {} }),
    };
    const port = await findFreePort();
    server = await startLocalBridgeServer(fakeDaemon as never, port);
    const base = `http://127.0.0.1:${port}`;

    // Before any diagnostics run: explicit "not run yet", not a misleading empty array.
    expect(JSON.parse(await get(`${base}/diagnostics`))).toEqual({
      findings: [],
      ran: false,
      at: null,
    });

    // After the daemon emits a run, the endpoint serves it (SSE event is gone by then).
    kernel.signalBus.emit("daemon:diagnostics:updated", { findings: [{ checkId: "x" }], at: 123 });
    expect(JSON.parse(await get(`${base}/diagnostics`))).toEqual({
      findings: [{ checkId: "x" }],
      at: 123,
    });

    // Unknown routes stay 404 — the fixed handler didn't swallow them.
    expect(JSON.parse(await get(`${base}/nope`))).toMatchObject({
      error: "unknown route: /nope",
    });
  });
});
