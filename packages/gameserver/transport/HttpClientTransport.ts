// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// HttpClientTransport.ts — CLIENT-side transport (fetch-only, zero node:*).
// Dipisah dari HttpTransport (server node:http) supaya bisa di-bundle ke
// renderer browser/Electron TANPA menarik node:http (CSP 'self', no CDN).
//
// Auth (P0-2): sendIntent login otomatis via POST /login sekali per playerId,
// lampirkan `Authorization: Bearer` di tiap /intent, dan login-ulang + retry
// SEKALI kalau server balas 401 (token expired). Secret HMAC /deliver TIDAK
// PERNAH ada di file ini — browser tidak boleh memegangnya; node caller
// menandatangani lewat opts.handoffSigner (gameserver/auth.signHandoff).

import type { PlayerIntent } from "../types";
import type { NetworkHandoff, TransportClient } from "./Transport";

export interface HttpClientTransport extends TransportClient {
  /** Kirim intent ke server (POST /intent, wajib Bearer token). */
  sendIntent(intent: PlayerIntent): Promise<{ ok: boolean; reason?: string; verdict?: string; seq?: number }>;
}

export interface HttpClientTransportOptions {
  /** Header tambahan untuk SEMUA request (mis. node caller menyetel cookie). */
  headers?: Record<string, string>;
  /** Tandatangan /deliver per request — server-to-server saja (node).
   *  Browser tanpa opsi ini akan ditolak 403 oleh server (memang by design). */
  handoffSigner?: (h: NetworkHandoff) => Record<string, string>;
}

interface HttpResult<T> {
  status: number;
  body: T;
}

export function createHttpClientTransport(baseUrl: string, opts: HttpClientTransportOptions = {}): HttpClientTransport {
  const post = <T>(path: string, body: unknown, headers?: Record<string, string>): Promise<HttpResult<T>> =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...opts.headers, ...headers },
      body: JSON.stringify(body),
    }).then(async (res) => ({ status: res.status, body: (await res.json()) as T }));

  const get = <T>(path: string): Promise<T> =>
    fetch(`${baseUrl}${path}`, { headers: { ...opts.headers } }).then((res) => res.json() as Promise<T>);

  // Token cache per playerId — /login sekali, dipakai ulang sampai 401.
  const tokens = new Map<string, string>();

  const login = async (playerId: string): Promise<string> => {
    const r = await post<{ ok?: boolean; token?: string; reason?: string }>("/login", { playerId });
    const token = r.body?.token;
    if (r.status !== 200 || !token) throw new Error(r.body?.reason ?? `login failed (${r.status})`);
    tokens.set(playerId, token);
    return token;
  };

  return {
    async requestSnapshot() { return get("/snapshot") as Promise<import("../types").RegionSnapshot>; },
    async deliver(h: NetworkHandoff) {
      const signerHeaders = opts.handoffSigner ? opts.handoffSigner(h) : {};
      const r = await post<{ ok: boolean; reason?: string }>("/deliver", h, signerHeaders);
      return r.body;
    },
    async sendIntent(intent: PlayerIntent) {
      try {
        let token = tokens.get(intent.playerId);
        if (!token) token = await login(intent.playerId);
        let r = await post<{ ok: boolean; reason?: string; verdict?: string; seq?: number }>("/intent", intent, {
          authorization: `Bearer ${token}`,
        });
        if (r.status === 401) {
          // Token expired/invalid — login ulang, retry SEKALI (bukan loop).
          tokens.delete(intent.playerId);
          token = await login(intent.playerId);
          r = await post<{ ok: boolean; reason?: string; verdict?: string; seq?: number }>("/intent", intent, {
            authorization: `Bearer ${token}`,
          });
        }
        return r.body;
      } catch (e) {
        return { ok: false, reason: (e as Error).message };
      }
    },
  };
}
