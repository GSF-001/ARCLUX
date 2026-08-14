/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { Notification } from "./Notification";

// A destination for notifications. NotificationManager fans each produced
// Notification out to every registered channel. Channels are deliberately
// dumb: they receive a fully-shaped Notification and decide how to render
// it (console line, desktop toast, editor popup). Implementations must not
// throw into the fan-out loop — NotificationManager guards against that,
// but channels should still prefer catching their own render errors.

export interface NotificationChannel {
  readonly id: string;
  deliver(notification: Notification): void;
}

/** Minimal reference implementation: one line per notification, prefixed by severity. */
export class ConsoleNotificationChannel implements NotificationChannel {
  readonly id = "console";

  deliver(notification: Notification): void {
    const location =
      notification.filePath && notification.line != null
        ? `${notification.filePath}:${notification.line}`
        : notification.filePath ?? "(no location)";
    // eslint-disable-next-line no-console
    console.log(`[arclux:${notification.severity}] ${notification.source} ${location} — ${notification.message}`);
  }
}
