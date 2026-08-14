// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

interface CacheEntry<V> {
  value: V;
  expiresAt: number | null;
}

export class MemoryCache<K, V> {
  private store = new Map<K, CacheEntry<V>>();

  set(key: K, value: V, ttlMs?: number): void {
    this.store.set(key, { value, expiresAt: ttlMs !== undefined ? Date.now() + ttlMs : null });
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
