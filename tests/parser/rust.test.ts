// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseCargoToml } from "../../packages/parser/rust/parseCargoToml"

// Fixture is a REAL Cargo.toml copied from tokio (github.com/tokio-rs/tokio).
// Already verified manually via scripts/testManifests.ts after the
// platform-conditional section fix (13 deps before fix, 36 after) - this
// test makes that verification permanent instead of eyeballed.
const FIXTURE_PATH = join(__dirname, "../fixtures/Cargo.toml.tokio")

describe("parseCargoToml", () => {
  it("parses all 36 dependencies from tokio's real Cargo.toml", () => {
    const content = readFileSync(FIXTURE_PATH, "utf-8")
    const deps = parseCargoToml.parse(content)

    expect(deps).toHaveLength(36)
  })

  it("splits runtime vs dev dependencies correctly (16 runtime, 20 dev)", () => {
    const content = readFileSync(FIXTURE_PATH, "utf-8")
    const deps = parseCargoToml.parse(content)

    const runtime = deps.filter((d) => d.kind === "runtime")
    const dev = deps.filter((d) => d.kind === "dev")

    expect(runtime).toHaveLength(16)
    expect(dev).toHaveLength(20)
  })

  it("resolves a platform-conditional single-dep section (windows-sys)", () => {
    const content = readFileSync(FIXTURE_PATH, "utf-8")
    const deps = parseCargoToml.parse(content)

    const windowsSys = deps.filter((d) => d.name === "windows-sys")
    // windows-sys appears in BOTH a runtime cfg(windows) section and a
    // dev-dependencies cfg(windows) section in tokio's real Cargo.toml -
    // this is the exact bug that was fixed (13 -> 36 deps), so this test
    // guards against a regression back to missing conditional sections.
    expect(windowsSys.length).toBeGreaterThan(0)
  })

  it("returns an empty array for a Cargo.toml with no dependency sections", () => {
    const deps = parseCargoToml.parse('[package]\nname = "foo"\nversion = "0.1.0"\n')
    expect(deps).toEqual([])
  })
})
