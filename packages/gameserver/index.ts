// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// `packages/gameserver` — authoritative ARCLUX MMO server core.
//
// Barrel: everything a shard host needs to run an authoritative region server
// (sim loop, world registry, validator, combat). Clients only render what this
// validates/simulates. Reuses packages/universe for vessel model + licensing.

export * from "./types";
export * from "./world";
export * from "./validator";
export * from "./simulation";
export * from "./combat";
export * from "./netcode";
export * from "./gate";
export * from "./persistence";
export * from "./bridge";