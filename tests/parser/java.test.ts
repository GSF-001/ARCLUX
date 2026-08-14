// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the Java parser (parseJava, regex/line-based): import forms
// (plain, wildcard, static), public-only exports, and same-scope scopeId.

import { describe, it, expect } from "vitest";
import { parseJava } from "../../packages/parser/java/parseJava";
import type { FileInfo } from "../../packages/shared/types";

function makeFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "java",
    extension: ".java",
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

async function parseJavaSource(source: string, relativePath = "src/com/example/Main.java") {
  return parseJava.parse(makeFile(relativePath), source);
}

describe("parseJava", () => {
  it("extracts plain, wildcard, and static imports", async () => {
    const parsed = await parseJavaSource(`
import java.util.List;
import java.util.*;
import static org.junit.Assert.assertEquals;
`);
    expect(parsed.imports).toHaveLength(3);
    expect(parsed.imports[0]).toMatchObject({ source: "java.util.List", hasNamespaceImport: false });
    expect(parsed.imports[1]).toMatchObject({ source: "java.util.*", hasNamespaceImport: true, namedImports: ["*"] });
    expect(parsed.imports[2].source).toBe("org.junit.Assert.assertEquals");
  });

  it("exports public classes, methods, and fields only", async () => {
    const parsed = await parseJavaSource(`
public class Main {
    public static void main(String[] args) { }
    public final String NAME = "x";
    private int hidden = 1;
    int packagePrivate = 2;
}
`);
    const names = parsed.exports.map((e) => e.name);
    expect(names).toContain("Main");
    expect(names).toContain("main");
    expect(names).toContain("NAME");
    expect(names).not.toContain("hidden");
    expect(names).not.toContain("packagePrivate");
  });

  it("exports interfaces, enums, and records", async () => {
    const parsed = await parseJavaSource(`
public interface Service { }
public enum Status { OK, FAIL }
public record Point(int x, int y) { }
`);
    const names = parsed.exports.map((e) => e.name);
    expect(names).toContain("Service");
    expect(names).toContain("Status");
    expect(names).toContain("Point");
  });

  it("sets scopeId to the directory for same-package resolution", async () => {
    const parsed = await parseJavaSource(
      "public class Main { }",
      "src/com/example/Main.java"
    );
    expect(parsed.scopeId).toBe("src/com/example");
  });
});
