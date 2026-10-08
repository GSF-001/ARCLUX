// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// auth.ts — otoritas identitas + handoff server-to-server (08 hardening P0-2/E-2).
//
// Dua mekanisme, dua tujuan:
//   1. Login token (Bearer): pemain → /login → token signed HMAC-SHA256 + exp.
//      /intent wajib bawa token (EVE SSO-style). Self-declared playerId dari
//      wire TIDAK dipercaya — sub token-lah yang jadi actor.
//   2. Handoff signature: POST /deliver hanya melayani shard terpercaya.
//      Payload di-sign HMAC-SHA256 atas raw body + timestamp (replay window
//      60s). Secret server-to-server (ARCLUX_HANDOFF_SECRET) — TIDAK PERNAH
//      dikirim ke browser client.
//
// Determinisme & safety: verifikasi pakai timingSafeEqual; exp dicek per
// verify (bukan cache). Fallback secret HANYA dev single-process: acak per
// proses (randomBytes) — production/multi-proses WAJIB set env
// ARCLUX_AUTH_SECRET / ARCLUX_HANDOFF_SECRET (lihat resolve*Secret).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Header HTTP untuk Bearer token login. */
export const AUTH_HEADER = "authorization";
/** Header HMAC untuk payload server-to-server /deliver. */
export const HANDOFF_HEADER = "x-arclux-handoff";
/** Replay window /deliver: signature valid ±60 detik dari now. */
export const HANDOFF_WINDOW_MS = 60_000;
/** Default lifetime login token (1 jam). */
export const LOGIN_TOKEN_TTL_MS = 3_600_000;

// Fallback acak per proses (cached) — BUKAN literal hardcoded: secret yang
// diketahui semua pembaca repo bisa dipakai memalsukan token/handoff di
// server yang lupa set env. Token lama mati saat proses restart; client
// auto-login (retry 401) menanganinya.
let authFallback: string | undefined;
let handoffFallback: string | undefined;

export function resolveAuthSecret(): string {
  try {
    const env = process.env.ARCLUX_AUTH_SECRET;
    if (env) return env;
  } catch { /* tanpa process env */ }
  authFallback ??= randomBytes(32).toString("hex");
  return authFallback;
}

export function resolveHandoffSecret(): string {
  try {
    const env = process.env.ARCLUX_HANDOFF_SECRET;
    if (env) return env;
  } catch { /* tanpa process env */ }
  handoffFallback ??= randomBytes(32).toString("hex");
  return handoffFallback;
}

export interface LoginTokenPayload {
  /** Subject — playerId yang diverifikasi server. */
  sub: string;
  /** Issued-at (epoch ms). */
  iat: number;
  /** Expiry (epoch ms). */
  exp: number;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Sign login token — payload {sub, iat, exp} base64url + HMAC-SHA256. */
export function signLoginToken(
  playerId: string,
  secret: string = resolveAuthSecret(),
  ttlMs: number = LOGIN_TOKEN_TTL_MS,
  now: number = Date.now()
): string {
  const payload: LoginTokenPayload = { sub: playerId, iat: now, exp: now + ttlMs };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body, secret)}`;
}

/** Verify login token. null = tidak ada / signature salah / expired. */
export function verifyLoginToken(
  token: string | null | undefined,
  secret: string = resolveAuthSecret(),
  now: number = Date.now()
): LoginTokenPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!sig || !safeEqual(hmac(body, secret), sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LoginTokenPayload;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Ekstrak nilai Bearer token dari header Authorization apa pun casing. */
export function bearerFromHeader(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1].trim() : null;
}

/** Sign raw body /deliver — server-to-server. Format: `${unixSec}.${hmac}`. */
export function signHandoff(
  rawBody: string,
  secret: string = resolveHandoffSecret(),
  now: number = Date.now()
): string {
  const ts = Math.floor(now / 1000).toString();
  return `${ts}.${hmac(`${ts}.${rawBody}`, secret)}`;
}

/** Verify signature /deliver atas RAW body (byte-identik dengan yang dikirim). */
export function verifyHandoff(
  rawBody: string,
  header: string | string[] | undefined,
  secret: string = resolveHandoffSecret(),
  now: number = Date.now(),
  windowMs: number = HANDOFF_WINDOW_MS
): boolean {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot <= 0) return false;
  const ts = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return false;
  if (Math.abs(Math.floor(now / 1000) - tsNum) * 1000 > windowMs) return false;
  return safeEqual(hmac(`${ts}.${rawBody}`, secret), sig);
}

/** IP allow-list /deliver: loopback selalu boleh (default self-host D-009),
 *  daftar tambahan dari opts.deliverAllowlist. Remote address dinormalisasi
 *  (::1 → 127.0.0.1, IPv4-mapped → IPv4). */
export function isDeliverAllowed(
  remoteAddress: string | undefined,
  allowlist: readonly string[] = []
): boolean {
  if (!remoteAddress) return false;
  const norm = remoteAddress.startsWith("::ffff:") ? remoteAddress.slice(7) : remoteAddress;
  if (norm === "127.0.0.1" || norm === "::1" || norm.startsWith("127.")) return true;
  return allowlist.includes(norm);
}
