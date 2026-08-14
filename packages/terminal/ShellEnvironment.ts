/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Builds the environment a managed shell/command runs with: the current
// process env merged with caller-provided overrides. Kept as a separate
// module so the merge/override policy lives in one place and can be
// tested without spawning anything.

export function buildShellEnvironment(overrides: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    // process.env values are typed string | undefined; spawn would
    // serialize undefined as the literal string "undefined", so drop them.
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...overrides };
}
