// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/CinematicEventDirector.ts - 10.C.2 event sequencing.
// Owns concurrent cinematic events: trigger, phase advance, priority
// resolution, expiry, cleanup. Every tick re-derives the winning context
// from live authority state so exposure and intensity never go stale.
// Presentation only: no gameplay state is read or written.

import type { CinematicContext, CinematicEventType, CinematicPhase } from "./CinematicContext";
import { deriveCinematicContext } from "./CinematicContext";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

// Phase schedule as fractions of event duration.
const PHASE_EDGES: { until: number; phase: CinematicPhase }[] = [
  { until: 0.12, phase: "TRIGGER" },
  { until: 0.25, phase: "PRE" },
  { until: 0.55, phase: "ACTIVE" },
  { until: 0.75, phase: "PEAK" },
  { until: 0.92, phase: "RECOVERY" },
  { until: Infinity, phase: "EXIT" },
];

const EXIT_GRACE_MS = 500;

export interface CinematicEvent {
  ctx: CinematicContext;
  startedAt: number; // ms on the deterministic clock
  duration: number; // ms
}

function phaseFor(progress: number): { phase: CinematicPhase; local: number } {
  let prev = 0;
  for (const edge of PHASE_EDGES) {
    if (progress < edge.until) {
      const span = edge.until - prev;
      return { phase: edge.phase, local: span > 0 ? (progress - prev) / span : 1 };
    }
    prev = edge.until;
  }
  return { phase: "EXIT", local: 1 };
}

export class CinematicEventDirector {
  private events: Map<string, CinematicEvent> = new Map();
  private seq = 0;

  /** Start an event. Returns its live context; id is stable for its lifetime. */
  trigger(
    envCtx: EnvironmentalContext,
    type: CinematicEventType,
    now: number,
    duration = 8000,
  ): CinematicContext {
    this.seq += 1;
    const eventId = `cin-${type}-${Math.floor(now)}-${this.seq}`;
    const ctx = deriveCinematicContext(envCtx, type, "TRIGGER", Math.floor(now), eventId);
    this.events.set(eventId, { ctx, startedAt: now, duration });
    return ctx;
  }

  /** Cancel all events of a type (e.g. storm passed before its event ended). */
  cancel(type: CinematicEventType): void {
    for (const [id, ev] of this.events) {
      if (ev.ctx.eventType === type) this.events.delete(id);
    }
  }

  has(type: CinematicEventType): boolean {
    for (const ev of this.events.values()) {
      if (ev.ctx.eventType === type && ev.ctx.phase !== "EXIT") return true;
    }
    return false;
  }

  /**
   * Advance all events and return the winning (highest-priority, live)
   * context, freshly re-derived from current authority state.
   */
  tick(envCtx: EnvironmentalContext, now: number): CinematicContext | null {
    let best: CinematicEvent | null = null;
    for (const ev of this.events.values()) {
      const elapsed = now - ev.startedAt;
      if (elapsed >= ev.duration + EXIT_GRACE_MS) {
        this.events.delete(ev.ctx.eventId);
        continue;
      }
      const { phase, local } = phaseFor(Math.max(0, elapsed / ev.duration));
      const fresh = deriveCinematicContext(envCtx, ev.ctx.eventType, phase, Math.floor(now), ev.ctx.eventId);
      fresh.transitionProgress = Math.min(1, Math.max(0, local));
      if (phase === "EXIT") fresh.exitCondition = "completed";
      ev.ctx = fresh;
      if (phase === "EXIT" && elapsed >= ev.duration) continue;
      if (!best || fresh.priority > best.ctx.priority) best = ev;
    }
    return best?.ctx ?? null;
  }

  /** Winning live context without advancing time. Honors expiry like tick. */
  getActive(now: number): CinematicContext | null {
    let best: CinematicEvent | null = null;
    for (const ev of this.events.values()) {
      if (ev.ctx.phase === "EXIT" && now - ev.startedAt >= ev.duration) continue;
      if (!best || ev.ctx.priority > best.ctx.priority) best = ev;
    }
    return best?.ctx ?? null;
  }
}
