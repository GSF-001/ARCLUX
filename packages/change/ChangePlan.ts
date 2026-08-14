/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { PatchSet } from "./PatchSet";

export interface ChangePlan {
  id: string;
  intent: string;
  patchSet: PatchSet;
  affectedModuleIds: string[];
  createdAt: number;
}

export function createChangePlan(
  intent: string,
  patchSet: PatchSet,
  affectedModuleIds: string[],
): ChangePlan {
  return {
    id: crypto.randomUUID(),
    intent,
    patchSet,
    affectedModuleIds,
    createdAt: Date.now(),
  };
}
