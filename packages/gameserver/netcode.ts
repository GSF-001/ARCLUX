// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// netcode.ts — transport client ↔ server (D-008 server-authoritative).
//
// Alur (mengikuti SimulationEngine yang SUDAH ada):
//   CLIENT send intent ─▶ transport.sendIntent → engine.enqueue
//   loop server:        transport.tick() → engine.step() → events → handlers
//   CLIENT re-sync:     transport.requestSnapshot() → region.snapshot()
//
// Client TIDAK menghitung hasil — ia kirim intent, terima events & state,
// lalu render (invariant I-1: client is not authoritative).

import type { GameEvent, PlayerIntent, RegionSnapshot } from "./types";
import type { SimulationEngine } from "./simulation";

/** Peta pendengar untuk satu tipe event yang dipancarkan server → client. */
export type NetEvent = GameEvent;

export interface NetcodeTransport {
  /** Terima intent dari client (diteruskan ke SimulationEngine.enqueue). */
  sendIntent(intent: PlayerIntent): void;
  /** Proses SATU tick server: drain queue, validate, sim, lalu pump events. */
  tick(): void;
  /** Client meminta snapshot state region untuk pertama render / re-sync. */
  requestSnapshot(): RegionSnapshot | undefined;
  /** Daftarkan handler event (combat, move, gate, governance, dst). */
  onEvent(handler: (ev: NetEvent) => void): void;
}

export interface NetcodeOptions {
  engine: SimulationEngine;
}

/**
 * In-process transport: bridge langsung ke SimulationEngine + pump event output
 * tiap tick. Berguna buat unit-test & prototype client-in-browser sebelum ada
 * transport jaringan beneran (TODO netcode[channel]).
 */
export function createInProcessTransport(opts: NetcodeOptions): NetcodeTransport {
  const handlers: Array<(ev: NetEvent) => void> = [];

  const sendIntent = (intent: PlayerIntent) => {
    opts.engine.enqueue(intent);
  };

  const onEvent = (handler: (ev: NetEvent) => void) => {
    handlers.push(handler);
  };

  const pumpEvents = (evs: NetEvent[]) => {
    for (const ev of evs) for (const h of handlers) h(ev);
  };

  const tick = () => {
    const result = opts.engine.step();
    pumpEvents([...result.accepted, ...result.rejected]);
  };

  const requestSnapshot = (): RegionSnapshot | undefined => {
    return opts.engine.region.snapshot();
  };

  return { sendIntent, tick, requestSnapshot, onEvent };
}
