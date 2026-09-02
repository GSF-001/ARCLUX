// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// HttpClientTransport.ts — CLIENT-side transport (fetch-only, zero node:*).
// Dipisah dari HttpTransport (server node:http) supaya bisa di-bundle ke
// renderer browser/Electron TANPA menarik node:http (CSP 'self', no CDN).

import type { PlayerIntent } from "../types";
import type { NetworkHandoff, TransportClient } from "./Transport";

export interface HttpClientTransport extends TransportClient {
  /** Kirim intent ke server (POST /intent). */
  sendIntent(intent: PlayerIntent): Promise<{ ok: boolean; reason?: string }>;
}

export function createHttpClientTransport(baseUrl: string): HttpClientTransport {
  const post = <T>(path: string, body: unknown): Promise<T> =>
    fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((res) => res.json() as Promise<T>);
  const get = <T>(path: string): Promise<T> => fetch(`${baseUrl}${path}`).then((res) => res.json() as Promise<T>);

  return {
    async requestSnapshot() { return get("/snapshot") as Promise<import("../types").RegionSnapshot>; },
    async deliver(h: NetworkHandoff) { return post<{ ok: boolean; reason?: string }>("/deliver", h); },
    async sendIntent(intent: PlayerIntent) {
      try { return await post<{ ok: boolean; reason?: string }>("/intent", intent); }
      catch (e) { return { ok: false, reason: (e as Error).message }; }
    },
  };
}