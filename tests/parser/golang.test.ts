// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the Go language parser (parseGo; the manifest parser
// parseGoMod is covered separately in go.test.ts): single-line and
// parenthesized imports, aliased imports, and the uppercase-first
// export convention for func/type/var/const.

import { describe, it, expect } from "vitest";
import { parseGo } from "../../packages/parser/go/parseGo";
import type { FileInfo } from "../../packages/shared/types";

function makeFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "go",
    extension: ".go",
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

async function parseGoSource(source: string, relativePath = "src/service.go") {
  return parseGo.parse(makeFile(relativePath), source);
}

describe("parseGo", () => {
  it("extracts single-line and parenthesized imports", async () => {
    const parsed = await parseGoSource(`
package main

import "fmt"
import (
    "strings"
    alias "github.com/gin-gonic/gin"
)

func main() {}
`);
    const sources = parsed.imports.map((i) => i.source);
    expect(sources).toEqual(["fmt", "strings", "github.com/gin-gonic/gin"]);
  });

  it("exports only uppercase-first identifiers", async () => {
    const parsed = await parseGoSource(`
package svc

func Exported() {}
func private() {}

type MyType struct{}

var Visible = 1
var hidden = 2
`);
    const names = parsed.exports.map((e) => e.name);
    expect(names).toContain("Exported");
    expect(names).toContain("MyType");
    expect(names).toContain("Visible");
    expect(names).not.toContain("private");
    expect(names).not.toContain("hidden");
  });

  it("exports methods with receivers and const blocks", async () => {
    const parsed = await parseGoSource(`
package repo

type Repo struct{}

func (r *Repo) Find() {}

const (
    DefaultLimit = 10
    MaxLimit     = 100
)
`);
    const names = parsed.exports.map((e) => e.name);
    expect(names).toContain("Find");
    expect(names).toContain("DefaultLimit");
    expect(names).toContain("MaxLimit");
  });

  it("sets scopeId to the directory for same-package resolution", async () => {
    const parsed = await parseGoSource("package main\n", "src/service.go");
    expect(parsed.scopeId).toBe("src");
  });
});
