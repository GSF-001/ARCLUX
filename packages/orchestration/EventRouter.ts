/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { SignalBus } from "../kernel/SignalBus";

// Declarative event routing on top of Kernel's SignalBus (issue #352).
// Instead of each subsystem hand-wiring "signalBus.on(X, () =>
// signalBus.emit(Y, ...))", routes are declared as data: an event on
// `from` is transformed and re-emitted on `to`. Unsubscribing all routes
// is a single call, which makes tearing a subsystem's wiring down (daemon
// stop, tests, hot reload) explicit instead of scattered `off` calls.

export interface EventRoute<F = unknown, T = unknown> {
  from: string;
  to: string;
  /** Maps the source payload to the target payload. Identity if omitted. */
  transform?: (payload: F) => T;
}

export class EventRouter {
  constructor(private readonly signalBus: SignalBus) {}

  /** Subscribes one route. Returns an unsubscribe function for that route. */
  route<F, T>(route: EventRoute<F, T>): () => void {
    return this.signalBus.on(route.from, (payload: F) => {
      const transformed = route.transform ? route.transform(payload) : payload;
      this.signalBus.emit(route.to, transformed as T);
    });
  }

  /** Subscribes many routes. Returns a single unsubscribe that removes all of them. */
  routeMany(routes: EventRoute[]): () => void {
    const unsubscribes = routes.map((route) => this.route(route));
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }
}
