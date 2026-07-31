// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SupportedLanguage } from "./types";

/** Maps a file extension (lowercase, with leading dot) to the language it implies. */
export const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".cs": "csharp",
  ".php": "php",
  ".rb": "ruby",
  ".rs": "rust",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
};

/** Extensions resolvePath.ts tries appending when an import has none, e.g. "./foo" -> "./foo.ts" */
export const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/** Filenames tried when an import resolves to a directory, e.g. "./foo" -> "./foo/index.ts" */
export const INDEX_FILENAMES = RESOLVABLE_EXTENSIONS.map((ext) => `index${ext}`);

/** Hex characters kept from a content hash — enough to avoid collisions within
 * one repo, short enough to stay readable in logs/cache keys. */
export const HASH_LENGTH = 12;

/** Default shallow clone depth used by git/cloneRepository.ts */
export const DEFAULT_CLONE_DEPTH = 1;
