// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { createHash } from "node:crypto";
import { HASH_LENGTH } from "./constants";

/**
 * Short content hash used for cache invalidation and incremental re-indexing
 * (FileInfo.hash, cache keys, etc). Not cryptographically sensitive — just needs
 * to change when content changes and stay short enough to be readable.
 */
export function hashContent(content: string): string {
  return createHash("sha1").update(content).digest("hex").slice(0, HASH_LENGTH);
}

/**
 * Hashes a JSON-serializable value by stringifying it first. Useful for cache
 * keys derived from options objects rather than raw file content.
 */
export function hashObject(value: unknown): string {
  return hashContent(JSON.stringify(value));
}
