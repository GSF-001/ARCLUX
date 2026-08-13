/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { EventEmitter } from "node:events";

export class SignalBus {
  private emitter = new EventEmitter();

  constructor() {
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
    if (signal) this.emitter.removeAllListeners(signal);
    else this.emitter.removeAllListeners();
  }
}
