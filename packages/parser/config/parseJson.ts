// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * Thin wrapper around JSON.parse that never throws — malformed JSON in a
 * manifest file (package.json, composer.json) should degrade to "no
 * dependencies found", not crash the whole detection pass. Manifest parsers
 * that are JSON-shaped (parsePackageJson.ts, parseComposer.ts) call this
 * instead of JSON.parse directly.
 */
export function parseJson<T = unknown>(content: string): T | undefined {
  try {
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}
