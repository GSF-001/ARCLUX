// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * Minimal flat-YAML key: value reader — NOT a full YAML parser (no nested
 * mappings beyond one level of indentation, no anchors/aliases, no flow
 * style). Currently unused by any manifest parser (no ARCLUX-supported
 * language manifest is YAML-shaped), kept as a primitive for a future one
 * (e.g. pubspec.yaml for Dart, if that's ever added).
 */
export function parseFlatYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const match = line.match(/^(\w[\w.-]*)\s*:\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    result[key] = rawValue.trim().replace(/^["'](.*)["']$/, "$1");
  }

  return result;
}
