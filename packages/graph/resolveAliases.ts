// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFileSync, existsSync, readdirSync } from "node:fs";
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
 * Reads the repo-root config AND each config in apps/* (e.g. apps/web/tsconfig.json,
 * the pnpm workspace members). In a monorepo, apps/web/tsconfig.json typically has
 * its own "@/*" pointing at apps/web/ (different base than the root's "@/*" pointing
 * at repo root) — without the nested configs, every "@/..." import inside apps/web
 * resolves against the WRONG base, falls through to "external package", and
 * produces mass false-positive unusedExports/orphanFiles findings (issue #372).
 * Rules from all configs are merged (targets rebased to be repo-root-relative);
 * resolvePath already tries every candidate rule, so extra bases are harmless —
 * a wrong-base candidate simply won't exist in knownFiles and gets skipped.
 *
 * Returns an empty rule set (never throws) if no config file exists or all are
 * malformed — a missing/broken tsconfig should never crash indexing, imports
 * will just fall back to being treated as external, same as before this existed.
 */
export function loadAliasConfig(repoRoot: string): AliasConfig {
  const rules: AliasRule[] = [];
  const seen = new Set<string>();

  // Root config first, then one level of apps/* (mirrors pnpm-workspace.yaml).
  const configRelDirs = [""];
  try {
    const appsDir = posix.join(repoRoot, "apps");
    for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) configRelDirs.push(posix.join("apps", entry.name));
    }
  } catch {
    // No apps/ directory (single-package repo) — the root config is enough.
  }

  for (const relDir of configRelDirs) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = posix.join(repoRoot, relDir, filename);
      if (!existsSync(configPath)) continue;

      try {
        const raw = readFileSync(configPath, "utf-8");
        const json = JSON.parse(stripJsonComments(raw)) as {
          compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
        };

        for (const rule of buildRules(json.compilerOptions?.paths, json.compilerOptions?.baseUrl, relDir)) {
          const key = `${rule.prefix}\u0000${rule.targets.join("\u0000")}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rules.push(rule);
        }
      } catch {
        // Malformed config — try the next candidate filename, or fall through to empty.
        continue;
      }
    }
  }

  // Longest prefix wins first, so a specific alias like "@/packages/*" is tried
  // before a catch-all like "@/*" when both could technically match.
  rules.sort((a, b) => b.prefix.length - a.prefix.length);

  return { rules };
}

function buildRules(
  paths: Record<string, string[]> | undefined,
  baseUrl: string | undefined,
  configRelDir = ""
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
      // Targets are relative to the config file's own directory (apps/web's
      // "./*" means apps/web/, not repo root). For the root config this is a
      // no-op ("" joins to the same path) — behavior is unchanged for it.
      base = posix.join(configRelDir, base);
      return base.endsWith("/") ? base : `${base}/`;
    });

    rules.push({ prefix, targets: normalizedTargets });
  }

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
 * tsconfig.json commonly has line comments (double slash), block comments
 * (slash-star ... star-slash) and trailing commas, none of which are valid
 * JSON. Strips just enough of that to make JSON.parse succeed. Implemented as
 * a small string-aware state machine: the naive regex approach breaks on real
 * Next.js configs, where path patterns like "@/" and double-star include
 * globs contain the literal sequences slash-star and star-slash INSIDE quoted
 * strings — a block-comment regex then eats everything between them,
 * corrupting the JSON and making loadAliasConfig return empty rules (issue #372).
 */
function stripJsonComments(input: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < input.length) {
    const c = input[i];

    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < input.length) {
        out += input[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i++;
      continue;
    }

    if (c === '"') {
      inString = true;
      out += c;
      i++;
      continue;
    }

    if (c === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    if (c === "/" && input[i + 1] === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (c === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (input[j] === "}" || input[j] === "]") {
        i++; // trailing comma — drop it, keep following whitespace
        continue;
      }
    }

    out += c;
    i++;
  }
  return out;
}
