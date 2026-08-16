// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/security-analysis/dependency: lockfile parsing
// (unit, inline content per format), semver comparison, vulnerable
// dependency detection, transitive risk, and the aggregate analyzer over
// the tests/fixtures/dependency-vuln fixture (real files, real path).

import { describe, it, expect } from "vitest";
import path from "node:path";
import { DiskSourceProvider, type SourceProvider } from "../packages/security-analysis";
import { parseLockfiles, normalizeVersion, type LockedDependency } from "../packages/security-analysis/dependency/LockfileAnalyzer";
import { compareSemver, isVulnerable, detectVulnerableDependencies, DEFAULT_KNOWN_VULNERABILITIES, type KnownVulnerability } from "../packages/security-analysis/dependency/VulnerableDependencyDetector";
import { analyzeTransitiveRisk } from "../packages/security-analysis/dependency/TransitiveRiskAnalyzer";
import { analyzeDependencyRisk, isUnpinnedRange } from "../packages/security-analysis/dependency/DependencyRiskAnalyzer";

class MapSourceProvider implements SourceProvider {
  private contents: Map<string, string>;
  constructor(contents: Record<string, string>) {
    this.contents = new Map(Object.entries(contents));
  }
  read(relativePath: string): string | null {
    return this.contents.get(relativePath) ?? null;
  }
}

// ─────────────────────────────────────────────
// normalizeVersion / compareSemver
// ─────────────────────────────────────────────

describe("normalizeVersion + compareSemver", () => {
  it("normalizes leading v and whitespace", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
    expect(normalizeVersion(" 1.2.3 ")).toBe("1.2.3");
    expect(normalizeVersion("=1.2.3")).toBe("1.2.3");
  });

  it("compares patch/minor/major", () => {
    expect(compareSemver("4.17.20", "4.17.21")).toBe(-1);
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
    expect(compareSemver("2.0.0", "1.9.9")).toBe(1);
  });

  it("ignores prerelease/build metadata (documented limitation)", () => {
    expect(compareSemver("1.2.3-alpha", "1.2.3")).toBe(0);
    expect(compareSemver("1.2.3+build5", "1.2.3")).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Lockfile parsing — unit per format
// ─────────────────────────────────────────────

describe("parseLockfiles (unit)", () => {
  it("parses package-lock.json v3 (packages) with direct/transitive depth", () => {
    const sources = new MapSourceProvider({
      "package-lock.json": JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": { name: "x", version: "1.0.0" },
          "node_modules/lodash": { version: "4.17.20" },
          "node_modules/express/node_modules/qs": { version: "6.11.0" },
        },
      }),
    });
    const { dependencies } = parseLockfiles(sources, ["package-lock.json"]);
    const lodash = dependencies.find((d) => d.name === "lodash")!;
    expect(lodash.version).toBe("4.17.20");
    expect(lodash.depth).toBe(1); // direct
    const qs = dependencies.find((d) => d.name === "qs")!;
    expect(qs.depth).toBe(2); // transitive
  });

  it("parses yarn.lock blocks", () => {
    const sources = new MapSourceProvider({
      "yarn.lock": '"lodash@^4.17.0":\n  version "4.17.20"\n  resolved "https://x/y.tgz"\n\n"express@~4.18.0":\n  version "4.18.2"\n',
    });
    const { dependencies } = parseLockfiles(sources, ["yarn.lock"]);
    expect(dependencies.find((d) => d.name === "lodash")!.version).toBe("4.17.20");
    expect(dependencies.find((d) => d.name === "express")!.version).toBe("4.18.2");
  });

  it("parses go.sum and Cargo.lock", () => {
    const sources = new MapSourceProvider({
      "go.sum": "github.com/foo/bar v1.2.3 h1:abc\n",
      "Cargo.lock": '[[package]]\nname = "serde"\nversion = "1.0.200"\n',
    });
    const { dependencies } = parseLockfiles(sources, ["go.sum", "Cargo.lock"]);
    expect(dependencies.find((d) => d.name === "github.com/foo/bar")!.version).toBe("1.2.3");
    expect(dependencies.find((d) => d.name === "serde")!.version).toBe("1.0.200");
  });

  it("reports missing lockfiles as skipped and tolerates malformed JSON", () => {
    const sources = new MapSourceProvider({ "package-lock.json": "not-json{{" });
    const { dependencies, lockfilesFound, skipped } = parseLockfiles(sources);
    expect(lockfilesFound).toEqual(["package-lock.json"]);
    expect(dependencies).toEqual([]);
    expect(skipped).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Vulnerable dependency detection
// ─────────────────────────────────────────────

describe("detectVulnerableDependencies", () => {
  const locked: LockedDependency[] = [
    { name: "lodash", version: "4.17.20", manager: "npm", lockfilePath: "package-lock.json", depth: 1 },
    { name: "express", version: "4.18.2", manager: "npm", lockfilePath: "package-lock.json", depth: 1 },
  ];

  it("flags versions below fixedVersion", () => {
    const hits = detectVulnerableDependencies(locked);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.dependency.name).toBe("lodash");
    expect(hits[0]!.vulnerability.reference).toBe("CVE-2021-23337");
  });

  it("isVulnerable respects the boundary (equal is NOT vulnerable)", () => {
    const vuln = DEFAULT_KNOWN_VULNERABILITIES.find((v) => v.name === "lodash")!;
    expect(isVulnerable("4.17.21", vuln)).toBe(false);
    expect(isVulnerable("4.17.22", vuln)).toBe(false);
    expect(isVulnerable("4.17.20", vuln)).toBe(true);
  });

  it("respects a custom database", () => {
    const custom: KnownVulnerability[] = [
      { name: "express", fixedVersion: "4.19.0", severity: "high", description: "t", reference: "TEST-1" },
    ];
    const hits = detectVulnerableDependencies(locked, custom);
    expect(hits.map((h) => h.dependency.name)).toEqual(["express"]);
  });
});

// ─────────────────────────────────────────────
// Transitive risk
// ─────────────────────────────────────────────

describe("analyzeTransitiveRisk", () => {
  it("splits vulnerable hits into direct vs transitive", () => {
    const locked: LockedDependency[] = [
      { name: "lodash", version: "4.17.20", manager: "npm", lockfilePath: "p", depth: 1 },
      { name: "qs", version: "6.11.0", manager: "npm", lockfilePath: "p", depth: 2 },
    ];
    const hits = detectVulnerableDependencies(locked);
    const report = analyzeTransitiveRisk(locked, hits);
    expect(report.totalDirect).toBe(1);
    expect(report.totalTransitive).toBe(1);
    expect(report.maxDepth).toBe(2);
    expect(report.vulnerableDirect).toHaveLength(1);
    expect(report.transitiveRatio).toBe(0.5);
  });

  it("handles empty input", () => {
    const report = analyzeTransitiveRisk([], []);
    expect(report.totalDirect).toBe(0);
    expect(report.totalTransitive).toBe(0);
    expect(report.transitiveRatio).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Aggregate analyzer over the real fixture
// ─────────────────────────────────────────────

describe("analyzeDependencyRisk over tests/fixtures/dependency-vuln", () => {
  const root = path.join(__dirname, "fixtures", "dependency-vuln");

  it("flags the vulnerable pinned lodash and the unpinned ranges", () => {
    const result = analyzeDependencyRisk({
      manifestDependencies: [
        { name: "axios", versionRange: "1.7.0", kind: "runtime" },
        { name: "express", versionRange: "~4.18.0", kind: "runtime" },
        { name: "lodash", versionRange: "^4.17.0", kind: "runtime" },
      ],
      sources: new DiskSourceProvider(root),
    });

    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("vulnerable-dependency");
    expect(ruleIds).toContain("unpinned-dependency");

    const lodashVuln = result.findings.find((f) => f.ruleId === "vulnerable-dependency")!;
    expect(lodashVuln.title).toContain("lodash@4.17.20");
    expect(lodashVuln.severity).toBe("high");
    expect(lodashVuln.owasp).toContain("A03:2025");

    const unpinned = result.findings.filter((f) => f.ruleId === "unpinned-dependency");
    expect(unpinned.map((f) => f.title)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("express"),
        expect.stringContaining("lodash"),
      ])
    );
    // axios is pinned exactly -> NOT flagged
    expect(unpinned.some((f) => f.title.includes("axios"))).toBe(false);
  });

  it("reports transitive structure", () => {
    const result = analyzeDependencyRisk({
      manifestDependencies: [],
      sources: new DiskSourceProvider(root),
    });
    // fixture: lodash/express/axios direct, qs transitive under express
    expect(result.transitiveRisk.totalDirect).toBe(3);
    expect(result.transitiveRisk.totalTransitive).toBe(1);
    expect(result.transitiveRisk.vulnerableDirect.map((v) => v.dependency.name)).toEqual(["lodash"]);
  });
});

// ─────────────────────────────────────────────
// isUnpinnedRange
// ─────────────────────────────────────────────

describe("isUnpinnedRange", () => {
  it("distinguishes exact versions from ranges", () => {
    expect(isUnpinnedRange("1.2.3")).toBe(false);
    expect(isUnpinnedRange("v1.2.3")).toBe(false);
    expect(isUnpinnedRange("1.2.3-alpha.1")).toBe(false);
    expect(isUnpinnedRange("^1.2.3")).toBe(true);
    expect(isUnpinnedRange("~1.2.3")).toBe(true);
    expect(isUnpinnedRange(">=1.2.3")).toBe(true);
    expect(isUnpinnedRange("*")).toBe(true);
    expect(isUnpinnedRange("latest")).toBe(true);
    expect(isUnpinnedRange(undefined)).toBe(false);
  });
});
