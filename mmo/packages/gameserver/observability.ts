// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// observability.ts — OTEL trace per tick + Prometheus tickMs/eventLog (Phase B).

export interface TickTrace {
  tick: number;
  regionId: string;
  durationMs: number;
  entityCount: number;
  eventCount: number;
  timestamp: string;
}

const traces: TickTrace[] = [];
const MAX_TRACES = 1000;

export function recordTickTrace(t: TickTrace): void {
  traces.push(t);
  if (traces.length > MAX_TRACES) traces.shift();
}

export function getTraces(limit = 100): TickTrace[] { return traces.slice(-limit); }

export function clearTraces(): void { traces.length = 0; }

export interface PrometheusMetrics {
  tickMs: number;
  eventLogSize: number;
  entityCount: number;
  tick: number;
}

export function toPrometheus(m: PrometheusMetrics): string {
  return [
    `# HELP arclux_tick_ms tick duration ms`,
    `# TYPE arclux_tick_ms gauge`,
    `arclux_tick_ms{region="${m.tick}"} ${m.tickMs}`,
    `# HELP arclux_event_log_size event log size`,
    `# TYPE arclux_event_log_size gauge`,
    `arclux_event_log_size ${m.eventLogSize}`,
    `# HELP arclux_entity_count entity count`,
    `# TYPE arclux_entity_count gauge`,
    `arclux_entity_count ${m.entityCount}`,
  ].join("\n");
}
