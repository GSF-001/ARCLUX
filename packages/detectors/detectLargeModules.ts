// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.

import type { Repository } from "../repository/Repository";

export interface LargeModuleFinding {
  filePath: string;
  sizeBytes: number;
  message: string;
}

const DEFAULT_THRESHOLD_BYTES = 15_000;

/**
 * Flags files above a size threshold — a coarse, deliberately simple
 * signal for "this file might be doing too much". Byte size is not the
 * same as complexity (a 15KB file of straightforward data could be fine,
 * a 3KB file of deeply nested logic could be worse), but it's a genuinely
 * available metric today (FileInfo.sizeBytes) versus something like
 * cyclomatic complexity, which nothing in the pipeline currently computes.
 */
export function detectLargeModules(
  repository: Repository,
  thresholdBytes: number = DEFAULT_THRESHOLD_BYTES
): LargeModuleFinding[] {
  const findings: LargeModuleFinding[] = [];

  for (const module of repository.getAllModules()) {
    if (module.file.sizeBytes > thresholdBytes) {
      findings.push({
        filePath: module.file.relativePath,
        sizeBytes: module.file.sizeBytes,
        message: `"${module.file.relativePath}" is ${module.file.sizeBytes.toLocaleString()} bytes, above the ${thresholdBytes.toLocaleString()}-byte threshold.`,
      });
    }
  }

  return findings.sort((a, b) => b.sizeBytes - a.sizeBytes);
}
