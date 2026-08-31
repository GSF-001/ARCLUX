// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// rateLimiter.ts — per-player intent rate limit (heavy tapi stabil, anti-spam).
// Token bucket: 20 intents/sec burst 40, D-008 authoritative.

export interface RateLimiterOptions {
  ratePerSec?: number;
  burst?: number;
}

export function createRateLimiter(opts: RateLimiterOptions = {}) {
  const rate = opts.ratePerSec ?? 20;
  const burst = opts.burst ?? 40;
  const buckets = new Map<string, { tokens: number; last: number }>();

  function allow(playerId: string, now = Date.now()): boolean {
    let b = buckets.get(playerId);
    if (!b) { b = { tokens: burst, last: now }; buckets.set(playerId, b); }
    const elapsed = (now - b.last) / 1000;
    b.tokens = Math.min(burst, b.tokens + elapsed * rate);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  function reset(playerId: string) { buckets.delete(playerId); }
  function remaining(playerId: string): number { return Math.floor(buckets.get(playerId)?.tokens ?? burst); }

  return { allow, reset, remaining };
}
