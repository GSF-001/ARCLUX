// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { posix } from "node:path";
import type { FileInfo } from "../shared/types";

const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;
const CONFIG_FILENAMES = new Set([
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "turbo.json",
  "next.config.ts",
  "next.config.js",
  "vite.config.ts",
]);

export function getFileName(file: FileInfo): string {
  return posix.basename(file.relativePath);
}

export function getDirectory(file: FileInfo): string {
  return posix.dirname(file.relativePath);
}

export function isTestFile(file: FileInfo): boolean {
  return TEST_FILE_PATTERN.test(file.relativePath);
}

export function isIndexFile(file: FileInfo): boolean {
  return /^index\.[jt]sx?$/.test(getFileName(file));
}

export function isConfigFile(file: FileInfo): boolean {
  return CONFIG_FILENAMES.has(getFileName(file));
}
