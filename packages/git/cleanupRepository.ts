// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

/**
 * Deletes the temp directory created by cloneRepository.ts.
 * Guards against accidentally rm -rf'ing something outside the OS temp dir —
 * cloneRepository.ts always creates paths under os.tmpdir(), so anything else is suspicious.
 */
export async function cleanupRepository(localPath: string): Promise<void> {
  const resolved = resolve(localPath);
  const systemTmp = resolve(tmpdir());

  if (!resolved.startsWith(systemTmp)) {
    throw new Error(
      `Refusing to delete "${resolved}": not inside system temp dir (${systemTmp}). ` +
        `This looks like a bug, not a real cleanup target.`
    );
  }

  await rm(resolved, { recursive: true, force: true });
}
