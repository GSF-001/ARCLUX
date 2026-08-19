/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * User-space detectors — the "detector as plugin" story. A detector is ONE
 * TypeScript file dropped into ~/.arclux/detectors/ exporting
 * { name, severity, run(repository) }. The shell's `doctor` command runs
 * the 19 built-in detectors PLUS every user detector, all through the same
 * safeRun isolation contract. A team rule ARCLUX doesn't ship with is a
 * file in a directory, not a core change.
 *
 * Detector file shape (default export):
 *
 *   import type { UserDetector } from "@arclux/engine";
 *
 *   export default {
 *     name: "noFooImports",
 *     severity: "error",
 *     run: (repository) => {
 *       const findings = [];
 *       for (const m of repository.getAllModules()) {
 *         if (m.imports.some((id) => id.includes("foo"))) {
 *           findings.push({ filePath: m.id, message: "imports foo — banned" });
 *         }
 *       }
 *       return findings;
 *     },
 *   } satisfies UserDetector;
 */

import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { UserDetector } from "../engine/runDoctor";

export interface LoadedDetector extends UserDetector {
  /** Absolute path of the detector file — where it was loaded from. */
  filePath: string;
}

function defaultDetectorsDir(): string {
  return join(homedir(), ".arclux", "detectors");
}

export interface LoadDetectorsOptions {
  dir?: string;
  fileNames?: string[];
}

export async function loadDetectors(options: LoadDetectorsOptions = {}): Promise<LoadedDetector[]> {
  const dir = resolve(options.dir ?? defaultDetectorsDir());
  const detectors: LoadedDetector[] = [];

  let fileNames: string[];
  try {
    fileNames = options.fileNames ?? readdirSync(dir).filter((f) => f.endsWith(".ts"));
  } catch {
    return [];
  }

  for (const fileName of fileNames) {
    const filePath = join(dir, fileName);
    try {
      const mod = (await import(pathToFileURL(filePath).href)) as { default?: unknown };
      const detector = mod.default as UserDetector | undefined;
      if (!detector || typeof detector.run !== "function" || typeof detector.checkId !== "string") {
        console.error(`[shell] detector ${fileName}: missing default export { checkId, severity, run(repository) } — skipped`);
        continue;
      }
      detectors.push({ ...detector, filePath });
    } catch (err) {
      console.error(
        `[shell] detector ${fileName} failed to load: ${err instanceof Error ? err.message : String(err)} — skipped`
      );
    }
  }

  return detectors;
}