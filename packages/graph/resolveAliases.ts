// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFileSync, existsSync } from "node:fs";
import { posix } from "node:path";

/**
 * One entry from tsconfig's `compilerOptions.paths`, normalized.
 * `prefix` is the part of the pattern before "*" (e.g. "@/" from "@/*").
 * `targets` are the corresponding replacement bases, already joined with
 * `baseUrl` and normalized to end with "/" (e.g. "../../packages/" from
 * "@/packages/*": ["../../packages/*"] with no baseUrl).
 */
export interface AliasRule {
  prefix: string;
  targets: string[];
}

export interface AliasConfig {
  rules: AliasRule[];
}

const CONFIG_FILENAMES = ["tsconfig.json", "jsconfig.json"];

/**
 * Loads path-alias rules for a repo by reading its tsconfig.json (or jsconfig.json)
 * `compilerOptions.paths` + `baseUrl`. Used so resolvePath.ts can turn "@/lib/api"
 * into a candidate internal module path instead of misreading it as an npm package.
 *
 * Returns an empty rule set (never throws) if no config file exists or it's
 * malformed — a missing/broken tsconfig should never crash indexing, imports
 * will just fall back to being treated as external, same as before this existed.
 */
export function loadAliasConfig(repoRoot: string): AliasConfig {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = posix.join(repoRoot, filename);
    if (!existsSync(configPath)) continue;

    try {
      const raw = readFileSync(configPath, "utf-8");
      const json = JSON.parse(stripJsonComments(raw)) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
      };

      const rules = buildRules(json.compilerOptions?.paths, json.compilerOptions?.baseUrl);
      if (rules.length > 0) {
        return { rules };
      }
    } catch {
      // Malformed tsconfig — try the next candidate filename, or fall through to empty.
      continue;
    }
  }

  return { rules: [] };
}

function buildRules(
  paths: Record<string, string[]> | undefined,
  baseUrl: string | undefined
): AliasRule[] {
  if (!paths) return [];

  const rules: AliasRule[] = [];

  for (const [pattern, targets] of Object.entries(paths)) {
    const starIndex = pattern.indexOf("*");
    const prefix = starIndex === -1 ? pattern : pattern.slice(0, starIndex);

    const normalizedTargets = targets.map((target) => {
      const targetStarIndex = target.indexOf("*");
      let base = targetStarIndex === -1 ? target : target.slice(0, targetStarIndex);
      if (baseUrl) {
        base = posix.join(baseUrl, base);
      }
      return base.endsWith("/") ? base : `${base}/`;
    });

    rules.push({ prefix, targets: normalizedTargets });
  }

  // Longest prefix wins first, so a specific alias like "@/packages/*" is tried
  // before a catch-all like "@/*" when both could technically match.
  rules.sort((a, b) => b.prefix.length - a.prefix.length);

  return rules;
}

/**
 * Given a raw import source (e.g. "@/lib/api"), returns every repo-root-relative
 * candidate path it could map to, in priority order. Does NOT touch the filesystem —
 * resolvePath.ts is responsible for checking `knownFiles` and trying extensions.
 * Returns [] if the import doesn't match any configured alias (i.e. it's not an
 * alias import at all — caller should fall back to relative/external handling).
 */
export function resolveAlias(importSource: string, config: AliasConfig): string[] {
  const candidates: string[] = [];

  for (const rule of config.rules) {
    if (!importSource.startsWith(rule.prefix)) continue;

    const remainder = importSource.slice(rule.prefix.length);
    for (const target of rule.targets) {
      candidates.push(posix.normalize(target + remainder));
    }
  }

  return candidates;
}

/**
 * tsconfig.json commonly has // comments and trailing commas, neither of which
 * are valid JSON. Strips just enough of that to make JSON.parse succeed —
 * not a full JSONC parser, but sufficient for standard tsconfig files.
 */
function stripJsonComments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/(^|[^:])\/\/.*$/gm, "$1") // line comments (careful not to eat "://")
    .replace(/,(\s*[}\]])/g, "$1"); // trailing commas
}
