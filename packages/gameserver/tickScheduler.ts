// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// tickScheduler.ts — heavy-stable tick loop (EVE-grade, komputer).
// Fixed 10 ticks/sec, catch-up, backpressure, no drift — D-008 authoritative.

export interface TickSchedulerOptions {
  tickMs?: number;
  maxCatchUp?: number;
  onTick: (tick: number, dt: number) => void | Promise<void>;
  onError?: (e: unknown) => void;
}

export function createTickScheduler(opts: TickSchedulerOptions) {
  const tickMs = opts.tickMs ?? 100;
  const maxCatchUp = opts.maxCatchUp ?? 5;
  let tick = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let last = Date.now();

  const loop = async () => {
    if (!running) return;
    const now = Date.now();
    let elapsed = now - last;
    let catchUp = 0;
    while (elapsed >= tickMs && catchUp < maxCatchUp) {
      tick++;
      try { await opts.onTick(tick, tickMs / 1000); } catch (e) { opts.onError?.(e); }
      elapsed -= tickMs;
      last += tickMs;
      catchUp++;
    }
    if (elapsed >= tickMs) last = now; // drop excess if lag too high
    timer = setTimeout(loop, Math.max(0, tickMs - (Date.now() - last)));
  };

  return {
    start() { if (running) return; running = true; last = Date.now(); loop(); },
    stop() { running = false; if (timer) clearTimeout(timer); timer = null; },
    get tick() { return tick; },
    get running() { return running; },
  };
}
