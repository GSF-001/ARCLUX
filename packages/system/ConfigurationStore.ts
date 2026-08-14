/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// In-memory system configuration store (issue #350). Plain key/value with
// typed defaults: get(key) falls back to the default for that key, so
// consumers never see undefined for declared settings. Deliberately
// process-local — persisted config is out of scope for the scaffold wave
// (see progres/decisions.md "Platform layer scaffold" entry).

export interface ConfigurationStoreOptions {
  defaults?: Record<string, unknown>;
}

export class ConfigurationStore {
  private values = new Map<string, unknown>();
  private readonly defaults: Record<string, unknown>;

  constructor(options: ConfigurationStoreOptions = {}) {
    this.defaults = options.defaults ?? {};
  }

  /** Returns the stored value, or the default for the key, or undefined if neither exists. */
  get<T = unknown>(key: string): T | undefined {
    if (this.values.has(key)) return this.values.get(key) as T;
    if (key in this.defaults) return this.defaults[key] as T;
    return undefined;
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  delete(key: string): boolean {
    return this.values.delete(key);
  }

  /** All explicitly-set keys (defaults are not materialized here). */
  listKeys(): string[] {
    return [...this.values.keys()];
  }

  /** Explicitly-set entries (defaults are not materialized here). */
  entries(): [string, unknown][] {
    return [...this.values.entries()];
  }

  clear(): void {
    this.values.clear();
  }
}
