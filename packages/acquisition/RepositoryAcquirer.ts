// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { AcquisitionPolicy } from "./AcquisitionPolicy";
import type { AcquisitionResult } from "./AcquisitionResult";
import { createSourceAcquirer } from "./SourceAcquirer";
import { statSync } from "node:fs";

export interface RepositoryAcquirer {
  id: string;
  source?: string;
  metadata?: Record<string, unknown>;
  acquire(source?: string, policy?: Partial<AcquisitionPolicy>): Promise<AcquisitionResult>;
}

export function createRepositoryAcquirer(source?: string): RepositoryAcquirer {
  const delegate = createSourceAcquirer(source);
  return {
    id: delegate.id,
    source,
    metadata: { kind: "repository" },
    async acquire(requestedSource = source, policy) {
      if (!requestedSource || !isRepositorySource(requestedSource)) {
        return { ok: false, errors: ["Repository acquisition requires a git URL or local directory."] };
      }
      return delegate.acquire(requestedSource, policy);
    },
  };
}

function isRepositorySource(source: string): boolean {
  try {
    const url = new URL(source);
    return ["http:", "https:", "ssh:", "git:"].includes(url.protocol);
  } catch {
    try {
      return statSync(source).isDirectory();
    } catch {
      return false;
    }
  }
}
