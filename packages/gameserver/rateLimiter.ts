// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// rateLimiter.ts — per-player + IP burst + shadowban (Phase C, anti-cheat production).

export interface RateLimiterOptions {
  ratePerSec?: number;
  burst?: number;
  shadowbanThreshold?: number;
}

export function createRateLimiter(opts: RateLimiterOptions = {}) {
  const rate = opts.ratePerSec ?? 20;
  const burst = opts.burst ?? 40;
  const shadowTh = opts.shadowbanThreshold ?? 10;
  const buckets = new Map<string, { tokens: number; last: number; violations: number; shadowbanned: boolean }>();

  function allow(playerId: string, ip?: string, now = Date.now()): boolean {
    const key = ip ? `${playerId}@${ip}` : playerId;
    let b = buckets.get(key);
    if (!b) { b = { tokens: burst, last: now, violations: 0, shadowbanned: false }; buckets.set(key, b); }
    if (b.shadowbanned) return false;
    const elapsed = (now - b.last) / 1000;
    b.tokens = Math.min(burst, b.tokens + elapsed * rate);
    b.last = now;
    if (b.tokens < 1) { b.violations++; if (b.violations >= shadowTh) b.shadowbanned = true; return false; }
    b.tokens -= 1;
    b.violations = Math.max(0, b.violations - 0.1);
    return true;
  }

  function reset(playerId: string) { for (const k of buckets.keys()) if (k.startsWith(playerId)) buckets.delete(k); }
  function remaining(playerId: string): number {
    for (const [k, b] of buckets) if (k.startsWith(playerId) && !b.shadowbanned) return Math.floor(b.tokens);
    return burst;
  }
  function isShadowbanned(playerId: string): boolean { for (const [k, b] of buckets) if (k.startsWith(playerId) && b.shadowbanned) return true; return false; }
  function unshadowban(playerId: string): void { for (const [k, b] of buckets) if (k.startsWith(playerId)) b.shadowbanned = false; }

  return { allow, reset, remaining, isShadowbanned, unshadowban };
}
