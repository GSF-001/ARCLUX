// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// packages/relay — SHARD REGISTRY + BRIDGE (D-005 multi-shard, D-009 self-host).
//
// Relay pusat (registry + gate config + identity lintas shard) — BUKAN game
// server. Scan MMO-IMPLEMENTATION.md §2.3 sebelum implementasi.
//
// Barrel: expose semua API relay.

export * from "./types";
export * from "./registry";
export * from "./gate";
export * from "./identity";
