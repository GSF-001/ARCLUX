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
import { parseGoMod } from "../../packages/parser/go/parseGoMod"

// Fixture is a REAL go.mod copied from gin (github.com/gin-gonic/gin),
// not hand-written. Same file already verified manually via
// scripts/testManifests.ts (35 deps, all runtime) - this test just
// makes that verification permanent and automatic instead of eyeballed.
const FIXTURE_PATH = join(__dirname, "../fixtures/go.mod.gin")

describe("parseGoMod", () => {
  it("parses all 35 dependencies from gin's real go.mod", () => {
    const content = readFileSync(FIXTURE_PATH, "utf-8")
    const deps = parseGoMod.parse(content)

    expect(deps).toHaveLength(35)
  })

  it("marks every dependency as runtime (Go has no dev-dependency concept)", () => {
    const content = readFileSync(FIXTURE_PATH, "utf-8")
    const deps = parseGoMod.parse(content)

    expect(deps.every((d) => d.kind === "runtime")).toBe(true)
  })

  it("includes a known direct dependency with its version", () => {
    const content = readFileSync(FIXTURE_PATH, "utf-8")
    const deps = parseGoMod.parse(content)

    const sonic = deps.find((d) => d.name === "github.com/bytedance/sonic")
    expect(sonic).toBeDefined()
    expect(sonic?.versionRange).toBe("v1.15.0")
  })

  it("returns an empty array for a go.mod with no require block", () => {
    const deps = parseGoMod.parse("module example.com/foo\n\ngo 1.21\n")
    expect(deps).toEqual([])
  })
})
