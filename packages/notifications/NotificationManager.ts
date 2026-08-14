/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Bridges the daemon's diagnostic events to channel consumers. ArcluxDaemon
// emits `daemon:diagnostics:updated` ({ findings, at }) on kernel.signalBus;
// this manager subscribes to that event, normalizes each DiagnosticFinding
// into a channel-neutral Notification, and fans it out to every registered
// NotificationChannel. Callers register channels here instead of subscribing
// to signalBus event names directly — see issue #353.

import type { SignalBus } from "../kernel/SignalBus";
import type { DiagnosticFinding } from "../diagnostics/DiagnosticEngine";
import type { Notification } from "./Notification";
import type { NotificationChannel } from "./NotificationChannel";

export interface DiagnosticsUpdatedPayload {
  findings: DiagnosticFinding[];
  at: number;
}

/** Normalizes one diagnostics run into notifications (one per finding). */
export function toNotifications(payload: DiagnosticsUpdatedPayload): Notification[] {
  return (payload.findings ?? []).map((f) => {
    const first = f.locations?.[0];
    return {
      id: `${f.checkId}:${first?.moduleId ?? "?"}:${first?.line ?? 0}`,
      severity: f.severity === "error" ? ("error" as const) : ("warning" as const),
      message: f.message || f.checkId,
      at: payload.at,
      source: f.checkId,
      filePath: first?.filePath ?? null,
      line: first?.line ?? null,
    };
  });
}

export class NotificationManager {
  private readonly channels = new Map<string, NotificationChannel>();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly signalBus: SignalBus) {}

  /** Register (or replace) a destination channel by its id. */
  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  unregisterChannel(id: string): boolean {
    return this.channels.delete(id);
  }

  hasChannel(id: string): boolean {
    return this.channels.has(id);
  }

  /** Subscribe to daemon diagnostic events. Idempotent. */
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.signalBus.on<DiagnosticsUpdatedPayload>("daemon:diagnostics:updated", (payload) => {
      this.fanOut(toNotifications(payload));
    });
  }

  /** Unsubscribe from daemon diagnostic events. Idempotent. */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private fanOut(notifications: Notification[]): void {
    if (notifications.length === 0) return;
    // Copy so a channel registering/unregistering during delivery can't
    // mutate the iteration, and so one throwing channel can't starve the rest.
    for (const channel of [...this.channels.values()]) {
      for (const notification of notifications) {
        try {
          channel.deliver(notification);
        } catch {
          // A broken channel must not take down the rest of the fan-out.
        }
      }
    }
  }
}
