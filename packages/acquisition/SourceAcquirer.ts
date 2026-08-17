// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { scanFiles } from "../parser/core/scanFiles";
import { RemoteRepository } from "../remote/RemoteRepository";
import type { AcquisitionPolicy } from "./AcquisitionPolicy";
import { assertSourceAllowed, defaultAcquisitionPolicy, resolveAcquisitionPolicy } from "./AcquisitionPolicy";
import type { AcquisitionResult } from "./AcquisitionResult";
import { createSnapshotFromFiles } from "./SourceSnapshot";

export interface SourceAcquirer {
  id: string;
  source?: string;
  metadata?: Record<string, unknown>;
  acquire(source?: string, policy?: Partial<AcquisitionPolicy>): Promise<AcquisitionResult>;
}

export function createSourceAcquirer(source?: string): SourceAcquirer {
  const acquirer: SourceAcquirer = {
    id: randomUUID(),
    source,
    async acquire(requestedSource = source, policy = defaultAcquisitionPolicy): Promise<AcquisitionResult> {
      if (!requestedSource) return { ok: false, errors: ["A source is required."] };

      try {
        const resolvedPolicy = resolveAcquisitionPolicy(policy);
        assertSourceAllowed(requestedSource, resolvedPolicy);
        const remote = isRemoteSource(requestedSource);

        if (remote) {
          const result = await withTimeout(
            new RemoteRepository({ id: acquirer.id, url: requestedSource }).analyze(),
            resolvedPolicy.timeoutMs,
          );
          const files = result.repository.getAllModules().map((module) => module.file.relativePath);
          return { ok: true, errors: [], snapshot: createSnapshotFromFiles(requestedSource, files, result.meta.defaultBranch) };
        }

        if (!statSync(requestedSource).isDirectory()) {
          throw new Error("Local acquisition source must be a directory.");
        }
        const fileInfo = scanFiles(requestedSource);
        const totalBytes = fileInfo.reduce((sum, file) => sum + file.sizeBytes, 0);
        if (totalBytes > resolvedPolicy.maxBytes) {
          throw new Error(`Source exceeds acquisition limit (${totalBytes} > ${resolvedPolicy.maxBytes} bytes).`);
        }
        return {
          ok: true,
          errors: [],
          snapshot: createSnapshotFromFiles(requestedSource, fileInfo.map((file) => file.relativePath)),
        };
      } catch (error) {
        return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
      }
    },
  };
  return acquirer;
}

function isRemoteSource(source: string): boolean {
  try {
    const url = new URL(source);
    return ["http:", "https:", "ssh:", "git:"].includes(url.protocol);
  } catch { return false; }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Acquisition timed out after ${timeoutMs}ms.`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
