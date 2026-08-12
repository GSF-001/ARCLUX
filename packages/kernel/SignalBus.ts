/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * SignalBus — pub/sub for kernel-level signals, built on Node's built-in
 * EventEmitter (no external dependency, unlike PM2's EventEmitter2 which
 * adds wildcard/namespaced matching). Exact-match event names only, e.g.
 * "process:online", "log:out", "log:err" — mirrors PM2's God.bus.emit
 * naming convention (see lib/God/ForkMode.js) without the wildcard layer.
 */

import { EventEmitter } from "node:events";

export class SignalBus {
  private emitter = new EventEmitter();

  constructor() {
    // Kernel may track many services; avoid Node's default 10-listener warning.
    this.emitter.setMaxListeners(1000);
  }

  on<T = unknown>(signal: string, handler: (payload: T) => void): () => void {
    this.emitter.on(signal, handler);
    return () => this.off(signal, handler);
  }

  off<T = unknown>(signal: string, handler: (payload: T) => void): void {
    this.emitter.off(signal, handler);
  }

  emit<T = unknown>(signal: string, payload: T): void {
    this.emitter.emit(signal, payload);
  }

  clear(signal?: string): void {
    if (signal) {
      this.emitter.removeAllListeners(signal);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}
