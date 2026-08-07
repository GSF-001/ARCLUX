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
import { resolveSameScopeDependencies, type ScopedFile } from "../../packages/indexer/resolveSameScopeDependencies"

// Uses the REAL fixtures already committed at playground/go-demo/ (not a
// copy) - these exist specifically to demonstrate the same-package
// implicit-dependency gap documented in parseGo.ts and parseJava.ts.
const FIXTURE_DIR = join(process.cwd(), "playground/go-demo")

function readFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), "utf-8")
}

describe("resolveSameScopeDependencies", () => {
  const files: ScopedFile[] = [
    {
      moduleId: "playground/go-demo/main.go",
      scopeId: "playground/go-demo",
      exports: [],
      content: readFixture("main.go"),
    },
    {
      moduleId: "playground/go-demo/service.go",
      scopeId: "playground/go-demo",
      exports: [{ name: "CreateUserProfile", kind: "named", line: 1 }],
      content: readFixture("service.go"),
    },
    {
      moduleId: "playground/go-demo/models.go",
      scopeId: "playground/go-demo",
      exports: [
        { name: "User", kind: "named", line: 1 },
        { name: "Product", kind: "named", line: 1 },
      ],
      content: readFixture("models.go"),
    },
    {
      moduleId: "playground/go-demo/utils.go",
      scopeId: "playground/go-demo",
      exports: [
        { name: "Slugify", kind: "named", line: 1 },
        { name: "UnusedHelper", kind: "named", line: 1 },
      ],
      content: readFixture("utils.go"),
    },
  ]

  const result = resolveSameScopeDependencies(files)

  it("finds main.go depends on models.go (uses User) and service.go (uses CreateUserProfile)", () => {
    const deps = result.get("playground/go-demo/main.go") ?? []
    expect(deps).toContain("playground/go-demo/models.go")
    expect(deps).toContain("playground/go-demo/service.go")
    expect(deps).toHaveLength(2)
  })

  it("finds service.go depends on models.go (User param type) and utils.go (calls Slugify)", () => {
    const deps = result.get("playground/go-demo/service.go") ?? []
    expect(deps).toContain("playground/go-demo/models.go")
    expect(deps).toContain("playground/go-demo/utils.go")
    expect(deps).toHaveLength(2)
  })

  it("finds no dependencies for models.go (only type definitions, calls nothing)", () => {
    expect(result.has("playground/go-demo/models.go")).toBe(false)
  })

  it("finds no dependencies for utils.go (UnusedHelper is genuinely unused, Slugify only calls external strings package)", () => {
    expect(result.has("playground/go-demo/utils.go")).toBe(false)
  })

  it("does not create a self-dependency", () => {
    // Sanity check on the whole-word matching: service.go itself contains
    // "CreateUserProfile" (its own function name in the signature), this
    // must NOT show up as service.go depending on itself.
    const deps = result.get("playground/go-demo/service.go") ?? []
    expect(deps).not.toContain("playground/go-demo/service.go")
  })

  it("returns empty deps for a lone file with no scope siblings", () => {
    const lonely: ScopedFile[] = [
      { moduleId: "solo/only.go", scopeId: "solo", exports: [{ name: "Foo", kind: "named", line: 1 }], content: "package solo" },
    ]
    const soloResult = resolveSameScopeDependencies(lonely)
    expect(soloResult.size).toBe(0)
  })
})
