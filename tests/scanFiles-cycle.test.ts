// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Regression test for the symlink/junction cycle guard added to
// scanFiles.ts in PR #303 (KI-007): a directory that links back to an
// ancestor must be visited once, not recursively forever (previously a
// junction loop turned one file into 64 duplicate "modules", bounded only
// by MAX_PATH).

import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanFiles } from "../packages/parser/core/scanFiles";

describe("scanFiles symlink/junction cycle guard", () => {
  it("visits a directory that links back to itself exactly once", () => {
    const root = mkdtempSync(join(tmpdir(), "scan-cycle-"));
    writeFileSync(join(root, "a.ts"), "export const a = 1;");

    const loop = join(root, "loop");
    try {
      if (process.platform === "win32") {
        symlinkSync(root, loop, "junction");
      } else {
        symlinkSync(root, loop);
      }
    } catch {
      // No symlink/junction privileges on this machine (e.g. Windows
      // without Developer Mode) — the guard is still covered by the
      // non-loop cases and the other tests.
      return;
    }

    const files = scanFiles(root);

    // Without the realpath-based visited set this resolves to loop/a.ts,
    // loop/loop/a.ts, … (MAX_PATH-deep duplicates). With the guard the
    // loop directory resolves to `root` and is skipped.
    const sources = files.filter((f) => f.relativePath.endsWith("a.ts"));
    expect(sources).toHaveLength(1);
    expect(sources[0].relativePath).toBe("a.ts");
  });
});
