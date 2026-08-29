// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// src/renderer/net.ts — wrapper netcode: kirim intent, terima events dari server.
//
// 🚧 SCAFFOLD. TODO implementasi di §TODOS.
//
// Ini jembatan renderer ↔ packages/gameserver/netcode.ts. Untuk prototipe,
// pakai createInProcessTransport (in-process). Untuk client beneran, ganti
// channel transport jaringan (TODO net).

import type { PlayerIntent } from "../../../../packages/gameserver/types";

export interface NetHandle {
  send(intent: PlayerIntent): void;
  onState(cb: (region: unknown) => void): void;
}

/**
 * 🚧 Inisialisasi koneksi client ke world.
 */
export function connectNet(): NetHandle {
  // TODO(net)[transport]  createInProcessTransport op createRelayTransport (gameserver/netcode)
  // TODO(net)[snapshot]   requestSnapshot → scene.renderRegion
  // TODO(net)[events]     pumpEvents → scene.updateVessel
  throw new Error("not implemented (scaffold)");
}
