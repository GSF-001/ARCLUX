// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SupportedLanguage } from "../../shared/types";

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
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
  ".sh": "bash",
  ".bash": "bash",
  ".c": "c",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".lua": "lua",
  ".m": "objc",
  ".mm": "objc",
  ".ml": "ocaml",
  ".mli": "ocaml",
  ".scala": "scala",
  ".sol": "solidity",
  ".swift": "swift",
  ".vue": "vue",
  ".zig": "zig",
};

export function detectLanguage(extension: string): SupportedLanguage {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] ?? "unknown";
}

export function isSupportedExtension(extension: string): boolean {
  return detectLanguage(extension) !== "unknown";
}

export function getExtensionsForLanguage(language: SupportedLanguage): string[] {
  return Object.entries(EXTENSION_TO_LANGUAGE)
    .filter(([, lang]) => lang === language)
    .map(([ext]) => ext);
}
