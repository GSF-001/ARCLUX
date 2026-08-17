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

export interface RepositoryAcquirer {
  id: string;
  source?: string;
  metadata?: Record<string, unknown>;
  acquire(source?: string, policy?: Partial<AcquisitionPolicy>): Promise<AcquisitionResult>;
}

export function createRepositoryAcquirer(source?: string): RepositoryAcquirer {
  const delegate = createSourceAcquirer(source);
  return { ...delegate, id: delegate.id };
}
