// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//

// cinematic/CinematicEventDirector.ts - 10.C Event Director: trigger/phase/priority/exit (CRASH 100 > EMERGENCY 90 > ENTRY 70). Zoom dari blueprint 10.C Event Sequencing.

// Resolved via the cinematic tick — see wire10X/wire10G wiring.

import type { CinematicContext, CinematicEventType, CinematicPhase } from "./CinematicContext";
import { deriveCinematicContext } from "./CinematicContext";
import type { EnvironmentalContext } from "../../../../../../packages/gameserver/planetary/environment";

export interface CinematicEvent {
  ctx: CinematicContext;
  startedAt: number;
  duration: number; // ms
}

export class CinematicEventDirector {
  private events: Map<string, CinematicEvent> = new Map();
  private now: number = 0;

  trigger(envCtx: EnvironmentalContext, type: CinematicEventType, now: number, duration = 8000): CinematicContext {
    const ctx = deriveCinematicContext(envCtx, type, "TRIGGER", now);
    this.events.set(ctx.eventId, { ctx, startedAt: now, duration });
    this.now = now;
    return ctx;
  }

  tick(envCtx: EnvironmentalContext, now: number): CinematicContext | null {
    this.now = now;
    // Update phases: TRIGGER->PRE (1s)->ACTIVE->PEAK (mid)->RECOVERY->EXIT
    for (const ev of this.events.values()) {
      const elapsed = now - ev.startedAt;
      const p = elapsed / ev.duration;
      let phase: CinematicPhase = "TRIGGER";
      if (p < 0.12) phase = "TRIGGER";
      else if (p < 0.25) phase = "PRE";
      else if (p < 0.55) phase = "ACTIVE";
      else if (p < 0.75) phase = "PEAK";
      else if (p < 0.92) phase = "RECOVERY";
      else phase = "EXIT";
      ev.ctx.phase = phase;
      ev.ctx.transitionProgress = p;
      if (phase === "EXIT") ev.ctx.exitCondition = "completed";
    }
    // Priority: highest priority active event wins
    let best: CinematicEvent | null = null;
    for (const ev of this.events.values()) {
      if (ev.ctx.phase === "EXIT" && now - ev.startedAt > ev.duration) continue;
      if (!best || ev.ctx.priority > best.ctx.priority) best = ev;
    }
    // Cleanup EXIT completed
    for (const [id, ev] of this.events) {
      if (ev.ctx.phase === "EXIT" && now - ev.startedAt > ev.duration + 500) this.events.delete(id);
    }
    return best?.ctx ?? null;
  }

  getActive(): CinematicContext | null {
    let best: CinematicEvent | null = null;
    for (const ev of this.events.values()) if (!best || ev.ctx.priority > best.ctx.priority) best = ev;
    return best?.ctx ?? null;
  }
}
