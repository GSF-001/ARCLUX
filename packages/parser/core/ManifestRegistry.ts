// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ManifestParser, ManifestDependency } from "./ManifestParserInterface";

/**
 * Central place where all manifest parsers register themselves, mirroring
 * ParserRegistry's role for LanguageParser. Consumers ask THIS which
 * manifest files are present in a repo and get back every dependency
 * across all of them, rather than importing individual parseX.ts files
 * directly.
 *
 * Fixes a real gap: parsePackageJson.ts, parseGoMod.ts, parseCargoToml.ts,
 * parseGemfile.ts, parseComposer.ts, parseCsproj.ts, parseGradlePom.ts,
 * and parseRequirements.ts all existed and worked correctly, but NONE
 * were ever referenced by any registry or detection code -- manifest
 * dependency parsing was 100% dead code project-wide until this file.
 */
export class ManifestRegistry {
  private parsersByFilename: Map<string, ManifestParser> = new Map();

  register(parser: ManifestParser): void {
    this.parsersByFilename.set(parser.filename, parser);
  }

  getParserForFilename(filename: string): ManifestParser | undefined {
    return this.parsersByFilename.get(filename);
  }

  get registeredFilenames(): string[] {
    return Array.from(this.parsersByFilename.keys());
  }

  /**
   * Scans rootPath for every registered manifest filename that's actually
   * present, parses each one found, and returns the combined dependency
   * list. A repo can legitimately have more than one manifest present
   * (e.g. a JS frontend + a Python backend in the same repo) -- all
   * matching manifests are parsed, not just the first one found.
   */
  detectDependencies(rootPath: string): ManifestDependency[] {
    const allDependencies: ManifestDependency[] = [];

    for (const [filename, parser] of this.parsersByFilename) {
      const filePath = join(rootPath, filename);
      if (!existsSync(filePath)) continue;

      try {
        const content = readFileSync(filePath, "utf-8");
        allDependencies.push(...parser.parse(content));
      } catch {
        // A single unreadable/malformed manifest shouldn't fail the whole
        // scan -- same "never throw" contract ManifestParser.parse itself
        // follows, applied here too in case readFileSync itself fails.
        continue;
      }
    }

    return allDependencies;
  }
}

/** Shared singleton registry — import THIS everywhere, don't `new ManifestRegistry()` elsewhere */
export const manifestRegistry = new ManifestRegistry();
