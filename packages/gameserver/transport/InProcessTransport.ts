// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// InProcessTransport.ts — in-process transport (unit test / prototype, D-009).
// Bridge langsung ke SimulationEngine + pump event per tick.

import type { NetworkHandoff, NetcodeTransport, NetcodeOptions, NetEvent } from "./Transport";

export function createInProcessTransport(opts: NetcodeOptions): NetcodeTransport {
  const handlers: Array<(ev: NetEvent) => void> = [];
  const sendIntent = (intent: import("../types").PlayerIntent) => opts.engine.enqueue(intent);
  const onEvent = (handler: (ev: NetEvent) => void) => handlers.push(handler);
  const requestSnapshot = () => opts.engine.region.snapshot();
  const tick = () => {
    const result = opts.engine.step();
    for (const ev of [...result.accepted, ...result.rejected]) for (const h of handlers) h(ev);
  };
  const deliver = async (h: NetworkHandoff): Promise<{ ok: boolean; reason?: string }> => {
    if (opts.engine.region.has(h.vesselId)) return { ok: false, reason: `entity already exists: ${h.vesselId}` };
    opts.engine.region.spawnVessel({ id: h.vesselId, owner: h.owner, vessel: h.vessel, position: h.position });
    return { ok: true };
  };
  return { sendIntent, tick, requestSnapshot, onEvent, deliver };
}
