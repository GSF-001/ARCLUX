// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/net.ts — wrapper netcode: kirim intent, terima snapshot/events dari server (D-008 authoritative).

import type { PlayerIntent, RegionSnapshot } from "../../../../packages/gameserver/types";
import { createHttpClientTransport } from "../../../../packages/gameserver/transport/HttpClientTransport";

/** Resolve shard URL — dynamic ARCLUX_GAME_PORT (env) atau fallback 24001. */
function resolveShardUrl(): string {
  // Directory wire — try discovery first (DIRECTORY ≠ AUTHORITY), fallback to env port
  // Vite/Electron renderer: guard for process availability
  const envPort = (() => {
    try {
      const g: any = globalThis as any;
      return g.process?.env?.ARCLUX_GAME_PORT ?? g.process?.env?.VITE_ARCLUX_GAME_PORT;
    } catch { return undefined; }
  })();
  const port = envPort ? Number(envPort) : 24001;
  // Allow override via globalThis.__ARCLUX_GAME_URL__ for tests
  try {
    const g: any = globalThis as any;
    if (g.__ARCLUX_GAME_URL__) return g.__ARCLUX_GAME_URL__;
  } catch {}
  return `http://127.0.0.1:${port}`;
}

export interface NetHandle {
  /** Client transport ke shard (requestSnapshot/sendIntent). */
  client: import("../../../../packages/gameserver/transport/HttpClientTransport").HttpClientTransport;
  /** URL shard yang dipakai. */
  url: string;
  /** Kirim intent via HTTP POST /intent — server-authoritative (D-008). */
  send(intent: PlayerIntent): Promise<void>;
  /** Poll snapshot periodik dan panggil cb. Returns stop fn. */
  onState(cb: (region: RegionSnapshot) => void): () => void;
  /** Satu-shot fetch snapshot. */
  fetchSnapshot(): Promise<RegionSnapshot>;
}

/**
 * Inisialisasi koneksi client ke world (HTTP, D-009 runtime terpisah).
 * Dynamic port via ARCLUX_GAME_PORT — wire ke apps/game tanpa hardcode.
 */
export function connectNet(url?: string, directoryUrl?: string): NetHandle {
  // Wire: try directory listServers public → first ONLINE endpoint (live, not yatim)
  const dirEndpoint = (() => {
    if (url) return undefined;
    try { const { listServers } = require("../../../../packages/directory/registry"); const s = listServers({ status: "ONLINE" as any })?.[0]; return s?.endpoint; } catch { return undefined; }
  })();
  const resolvedUrl = url ?? dirEndpoint ?? directoryUrl ?? resolveShardUrl();
  const client = createHttpClientTransport(resolvedUrl);

  const fetchSnapshot = () => client.requestSnapshot();

  const onState = (cb: (region: RegionSnapshot) => void): (() => void) => {
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try { cb(await client.requestSnapshot()); } catch {}
      if (!stopped) setTimeout(poll, 100);
    };
    poll();
    return () => { stopped = true; };
  };

  const send = async (intent: PlayerIntent): Promise<void> => {
    await client.sendIntent(intent);
  };

  return { client, url: resolvedUrl, send, onState, fetchSnapshot };
}
