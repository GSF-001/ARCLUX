// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * Minimal TOML reader — NOT a full spec-compliant TOML parser (no arrays of
 * tables, no inline tables, no multi-line strings). Handles exactly what
 * Cargo.toml's [dependencies]/[dev-dependencies] sections need:
 * `[section]` headers and `key = "value"` / `key = { version = "value", ... }`
 * lines. Sufficient for parseCargoToml.ts; do not reuse this for a TOML file
 * with more advanced syntax without extending it first.
 */
export interface TomlSection {
  name: string;
  entries: Record<string, string>;
}

export function parseTomlSections(content: string): TomlSection[] {
  const sections: TomlSection[] = [];
  let current: TomlSection | undefined;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      current = { name: sectionMatch[1], entries: {} };
      sections.push(current);
      continue;
    }

    if (!current) continue;

    const kvMatch = line.match(/^([\w.-]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let value = kvMatch[2].trim();

    // Inline table like { version = "1.2.0", features = [...] } — pull out
    // just the "version" field, since that's all callers need so far.
    const inlineTableMatch = value.match(/version\s*=\s*"([^"]*)"/);
    if (value.startsWith("{") && inlineTableMatch) {
      value = inlineTableMatch[1];
    } else {
      value = value.replace(/^"(.*)"$/, "$1");
    }

    current.entries[key] = value;
  }

  return sections;
}
