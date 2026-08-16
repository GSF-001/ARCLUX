// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface ArchiveAcquirer {
  id: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export function createArchiveAcquirer(source?: string): ArchiveAcquirer {
  return { id: crypto.randomUUID(), source };
}
