// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readdirSync, statSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { readGitignore } from "../../git/readGitignore";
import { EXTENSION_TO_LANGUAGE } from "../../shared/constants";
import { hashContent } from "../../shared/hash";
import { toPosixPath } from "../../shared/paths";
import type { FileInfo, SupportedLanguage } from "../../shared/types";

function detectLanguage(extension: string): SupportedLanguage {
  return EXTENSION_TO_LANGUAGE[extension] ?? "unknown";
}

/**
 * Recursively walks `rootPath`, returning FileInfo for every non-ignored file.
 * This does NOT parse file contents beyond hashing — that's parser/*'s job.
 */
export function scanFiles(rootPath: string): FileInfo[] {
  const ig = readGitignore(rootPath);
  const results: FileInfo[] = [];
  // Guard against symlink/junction cycles: a directory that resolves back
  // to an already-visited real path would otherwise recurse forever (or,
  // bounded by MAX_PATH on Windows, silently explode into duplicate
  // modules). Track real paths instead of lexical ones so that two
  // different symlinks to the same directory are visited only once.
  const visitedRealDirs = new Set<string>();

  function walk(dir: string) {
    let realDir: string;
    try {
      realDir = realpathSync(dir);
    } catch {
      return; // path vanished or is otherwise unresolvable — nothing to scan
    }
    if (visitedRealDirs.has(realDir)) return;
    visitedRealDirs.add(realDir);

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = join(dir, entry);
      const relativePath = toPosixPath(relative(rootPath, absolutePath));

      if (ig.ignores(relativePath)) continue;

      let stat;
      try {
        stat = statSync(absolutePath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!stat.isFile()) continue;

      const extension = extname(entry).toLowerCase();
      const language = detectLanguage(extension);
      if (language === "unknown") continue;

      let content: string;
      try {
        content = readFileSync(absolutePath, "utf-8");
      } catch {
        continue;
      }

      results.push({
        absolutePath,
        relativePath,
        language,
        extension,
        sizeBytes: stat.size,
        hash: hashContent(content),
      });
    }
  }

  walk(rootPath);
  return results;
}
