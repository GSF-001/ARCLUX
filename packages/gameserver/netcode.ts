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
// 🚧 SCAFFOLD — kerangka implementasi. Bagian yang jadi ditandai `// IMPL:`.
//
// Alur (mengikuti SimulationEngine yang SUDAH ada):
//
// ```
// CLIENT                       SERVER (SimulationEngine)
//   │ input intent -----------------▶ enqueue({playerId,...})
//   │                                step() → validate + sim → events
//   │ ◀── RegionState snapshot / events / damage
// ```
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
  /** Client meminta snapshot state region untuk pertama render / re-sync. */
  requestSnapshot(): RegionSnapshot | undefined;
  /** Daftarkan handler event (combat, move, gate, governance, dst). */
  onEvent(handler: (ev: NetEvent) => void): void;
}

export interface NetcodeOptions {
  engine: SimulationEngine;
  /**
   * ambil snapshot terkini region dari engine (IMPLEMENTED via engine.region).
   * Pemutusan: transport nge-proxy engine.enqueue & event ke handler, plus
   * polling snapshot. Nanti diganti channel (WebSocket) di apps/game + server.
   */
}

/**
 * 🚧 In-process transport: bridge langsung ke SimulationEngine. Berguna buat
 * unit-test & prototype client-in-browser sebelum ada transport jaringan beneran.
 */
export function createInProcessTransport(opts: NetcodeOptions): NetcodeTransport {
  const handlers: Array<(ev: NetEvent) => void> = [];

  const sendIntent = (intent: PlayerIntent) => {
    // IMPL: retain seq ordering + back-pressure (jangan banjiri queue),
    //       lalu engine.enqueue(intent). Setiap step(), events yang dihasilkan
    //       engine harus dibagikan ke handlers.
    opts.engine.enqueue(intent);
    void opts;
    // TODO(netcode): jembatani event output engine → handlers tiap step
  };

  const onEvent = (handler: (ev: NetEvent) => void) => {
    handlers.push(handler);
  };

  // IMPL(netcode): panggil ini tiap SimulationEngine.step() selesai — terapkan
  // list event output engine ke semua handler (lihat TODO(netcode)[events]).
  const pumpEvents = (evs: NetEvent[]) => {
    for (const ev of evs) for (const h of handlers) h(ev);
  };
  void pumpEvents;

  const requestSnapshot = (): RegionSnapshot | undefined => {
    return opts.engine.region.snapshot();
  };

  return { sendIntent, requestSnapshot, onEvent };
}

//
// §TODOS — tinggal isi satu per satu, update check saat selesai
//
// TODO(netcode)[events]   pipeline: output event SimulationEngine.step() → emit ke handlers
// TODO(netcode)[auth]     resolver player id: authProvider → actor id sebelum enqueue
// TODO(netcode)[seq]      ordering: pastikan intent diproses sesuai seq request
// TODO(netcode)[channel]  ganti in-process → transport jaringan (WebSocket) utk apps/game
// TODO(netcode)[snapshot] throttle requestSnapshot & delta-sync (jangan kirim full tiap tick)
