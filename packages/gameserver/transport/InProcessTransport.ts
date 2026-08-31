// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
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
