// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/** Removes duplicate values from an array while preserving order. */
export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Groups an array of items by a key derived from each item. */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/** Splits an array into chunks of at most `size` items each. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/** Parses JSON, returning `fallback` instead of throwing on malformed input. */
export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

/** Awaitable delay, e.g. for retry backoff. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a debounced version of `fn` that only runs `waitMs` after the last
 * call. Used by watcher/changeQueue.ts so a burst of filesystem events
 * (e.g. a git checkout touching hundreds of files) triggers one re-index,
 * not hundreds.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number
): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), waitMs);
  };
}
