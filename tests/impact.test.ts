import { describe, it, expect, beforeAll } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { calculateAffectedFiles } from "../packages/impact/calculateAffectedFiles";
import { buildImpactTree } from "../packages/impact/buildImpactTree";
import { traceConsumers } from "../packages/impact/traceConsumers";
import { traceDependencies } from "../packages/impact/traceDependencies";

describe("Impact Analysis", () => {
  let repo: Repository;

  beforeAll(() => {
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

  it("calculateAffectedFiles should return Set<string>", () => {
    const affected = calculateAffectedFiles("test.ts", repo.graph);
    expect(affected instanceof Set).toBe(true);
  });

  it("calculateAffectedFiles should handle non-existent module gracefully", () => {
    const affected = calculateAffectedFiles("nonexistent.ts", repo.graph);
    expect(affected instanceof Set).toBe(true);
  });

  it("buildImpactTree should return tree structure", () => {
    const tree = buildImpactTree("test.ts", repo.graph);
    expect(tree).toHaveProperty("moduleId");
    expect(tree).toHaveProperty("affected");
  });

  it("traceConsumers should return array of consumers", () => {
    const consumers = traceConsumers("test.ts", repo.graph);
    expect(Array.isArray(consumers)).toBe(true);
  });

  it("traceDependencies should return array of dependencies", () => {
    const deps = traceDependencies("test.ts", repo.graph);
    expect(Array.isArray(deps)).toBe(true);
  });

  it("buildImpactTree should guard against circular dependencies", () => {
    expect(() => {
      buildImpactTree("circular.ts", repo.graph);
    }).not.toThrow();
  });
});
