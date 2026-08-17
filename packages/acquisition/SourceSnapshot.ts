// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface SourceSnapshot {
  id: string;
  source: string;
  revision?: string;
  createdAt: string;
  files: string[];
}

export function createSourceSnapshot(
  source: string,
  files: string[],
  revision?: string,
): SourceSnapshot {
  return {
    id: crypto.randomUUID(),
    source,
    revision,
    createdAt: new Date().toISOString(),
    files: [...files],
  };
}

export function createSnapshotFromFiles(
  source: string,
  files: readonly string[],
  revision?: string,
): SourceSnapshot {
  return createSourceSnapshot(source, [...new Set(files)].sort(), revision);
}
