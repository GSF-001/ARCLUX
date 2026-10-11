// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// observability.ts — OTEL trace per tick + Prometheus (Phase B) + P3-4.
//
// P3-4 (08 audit): METRIC INTENT — accepted/rejected rate, alasan reject
// (histogram per reason), tick p99 (dari ring buffer), tick terdilasi.
// /metrics di server memakai `toPrometheus`.

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
  tickDurations.push(t.durationMs);
  if (tickDurations.length > MAX_TICK_DURATIONS) tickDurations.shift();
}

export function getTraces(limit = 100): TickTrace[] { return traces.slice(-limit); }

export function clearTraces(): void { traces.length = 0; tickDurations.length = 0; intentAccepted = 0; intentRejected = 0; rejectReasons.clear(); dilatedTicks = 0; }

// ---- P3-4 counters ----

const MAX_TICK_DURATIONS = 512;
const tickDurations: number[] = [];

let intentAccepted = 0;
let intentRejected = 0;
const rejectReasons = new Map<string, number>();
let dilatedTicks = 0;

export function countIntentAccepted(): void { intentAccepted++; }
export function countIntentRejected(reason: string): void {
  intentRejected++;
  rejectReasons.set(reason, (rejectReasons.get(reason) ?? 0) + 1);
}
/** Tick yang melebihi target durasi (tick terdilasi — 08 §audit). */
export function countDilatedTick(): void { dilatedTicks++; }

/** p99 dari ring buffer durasi tick (ms). */
export function tickP99Ms(): number {
  if (tickDurations.length === 0) return 0;
  const sorted = [...tickDurations].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
  return sorted[idx];
}

export interface PrometheusMetrics {
  tickMs: number;
  eventLogSize: number;
  entityCount: number;
  tick: number;
}

export function toPrometheus(m: PrometheusMetrics): string {
  const lines = [
    `# HELP arclux_tick_ms tick duration ms`,
    `# TYPE arclux_tick_ms gauge`,
    `arclux_tick_ms{region="${m.tick}"} ${m.tickMs}`,
    `# HELP arclux_event_log_size event log size`,
    `# TYPE arclux_event_log_size gauge`,
    `arclux_event_log_size ${m.eventLogSize}`,
    `# HELP arclux_entity_count entity count`,
    `# TYPE arclux_entity_count gauge`,
    `arclux_entity_count ${m.entityCount}`,
    `# HELP arclux_intent_accepted_total intent diterima`,
    `# TYPE arclux_intent_accepted_total counter`,
    `arclux_intent_accepted_total ${intentAccepted}`,
    `# HELP arclux_intent_rejected_total intent ditolak`,
    `# TYPE arclux_intent_rejected_total counter`,
    `arclux_intent_rejected_total ${intentRejected}`,
    `# HELP arclux_intent_rejected_by_reason_total penolakan per alasan`,
    `# TYPE arclux_intent_rejected_by_reason_total counter`,
  ];
  for (const [reason, n] of [...rejectReasons].sort()) {
    lines.push(`arclux_intent_rejected_by_reason_total{reason="${reason.replace(/"/g, "")}"} ${n}`);
  }
  lines.push(
    `# HELP arclux_tick_p99_ms p99 durasi tick`,
    `# TYPE arclux_tick_p99_ms gauge`,
    `arclux_tick_p99_ms ${tickP99Ms()}`,
    `# HELP arclux_dilated_ticks_total tick terdilasi`,
    `# TYPE arclux_dilated_ticks_total counter`,
    `arclux_dilated_ticks_total ${dilatedTicks}`,
  );
  return lines.join("\n");
}
