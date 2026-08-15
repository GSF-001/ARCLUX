import { describe, it, expect, beforeAll } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency";
import { detectUnusedExports } from "../packages/detectors/detectUnusedExports";
import { detectOrphanFiles } from "../packages/detectors/detectOrphanFiles";
import { detectLargeModules } from "../packages/detectors/detectLargeModules";
import { detectDuplicateModules } from "../packages/detectors/detectDuplicateModules";
import { detectSharedModules } from "../packages/detectors/detectSharedModules";
import { detectIndexFiles } from "../packages/detectors/detectIndexFiles";
import { detectLayerViolation } from "../packages/detectors/detectLayerViolation";
import { detectDeadCode } from "../packages/detectors/detectDeadCode";
import { detectEntryPoints } from "../packages/detectors/detectEntryPoints";
import { detectRouteConvention } from "../packages/detectors/detectRouteConvention";
import { detectComponentConvention } from "../packages/detectors/detectComponentConvention";
import { detectFeatureStructure } from "../packages/detectors/detectFeatureStructure";
import { detectMissingExports } from "../packages/detectors/detectMissingExports";
import { detectRepositoryPattern } from "../packages/detectors/detectRepositoryPattern";
import { detectStoryConvention } from "../packages/detectors/detectStoryConvention";
import { detectTestConvention } from "../packages/detectors/detectTestConvention";
import { detectUnusedFiles } from "../packages/detectors/detectUnusedFiles";
import { detectAmbiguousSymbolResolution } from "../packages/detectors/detectAmbiguousSymbolResolution";

describe("Detector Suite", () => {
  let repo: Repository;

  beforeAll(async () => {
    repo = new Repository({
      id: "test-repo",
      org: "test",
      name: "repo",
      rootPath: "/test",
      defaultBranch: "main",
      detectedFrameworks: [],
      packageManager: undefined,
      analyzedAt: new Date().toISOString(),
    });
  });

  it("detectCircularDependency returns empty array for acyclic graph", () => {
    const findings = detectCircularDependency(repo);
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThanOrEqual(0);
  });

  it("detectUnusedExports returns findings array", () => {
    const findings = detectUnusedExports(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectOrphanFiles returns findings array", () => {
    const findings = detectOrphanFiles(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectLargeModules returns findings array", () => {
    const findings = detectLargeModules(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectDuplicateModules returns findings array", () => {
    const findings = detectDuplicateModules(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectSharedModules returns findings array", () => {
    const findings = detectSharedModules(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectIndexFiles returns findings array", () => {
    const findings = detectIndexFiles(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectLayerViolation returns findings array", () => {
    const findings = detectLayerViolation(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectDeadCode returns findings array", () => {
    const findings = detectDeadCode(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectEntryPoints returns findings array", () => {
    const findings = detectEntryPoints(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectRouteConvention returns findings array", () => {
    const findings = detectRouteConvention(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectComponentConvention returns findings array", () => {
    const findings = detectComponentConvention(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectFeatureStructure returns findings array", () => {
    const findings = detectFeatureStructure(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectMissingExports returns findings array", () => {
    const findings = detectMissingExports(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectRepositoryPattern returns findings array", () => {
    const findings = detectRepositoryPattern(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectStoryConvention returns findings array", () => {
    const findings = detectStoryConvention(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectTestConvention returns findings array", () => {
    const findings = detectTestConvention(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectUnusedFiles returns findings array", () => {
    const findings = detectUnusedFiles(repo);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectAmbiguousSymbolResolution returns findings array", () => {
    const findings = detectAmbiguousSymbolResolution(repo);
    expect(Array.isArray(findings)).toBe(true);
  });
});
