/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Applies a ChangePlan's PatchSet to disk. Does not write directly --
// every file goes through packages/storage/RecoveryManager's
// writeTransactional(), so a crash mid-apply can recover via
// recoverFromJournal() instead of leaving a half-written repo.

import { writeTransactional } from "../storage/RecoveryManager";
import type { ChangePlan } from "./ChangePlan";

export interface ChangeExecutionResult {
  planId: string;
  filesWritten: string[];
  failedFiles: { filePath: string; error: string }[];
}

export function executeChangePlan(plan: ChangePlan): ChangeExecutionResult {
  const filesWritten: string[] = [];
  const failedFiles: { filePath: string; error: string }[] = [];

  for (const patch of plan.patchSet.patches) {
    try {
      writeTransactional(patch.filePath, patch.newContent);
      filesWritten.push(patch.filePath);
    } catch (err) {
      failedFiles.push({
        filePath: patch.filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { planId: plan.id, filesWritten, failedFiles };
}
