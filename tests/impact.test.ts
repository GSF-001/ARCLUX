import { describe, it, expect, beforeAll } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { calculateAffectedFiles } from "../packages/impact/calculateAffectedFiles";
import { buildImpactTree } from "../packages/impact/buildImpactTree";
import { traceConsumers } from "../packages/impact/traceConsumers";
import { traceDependencies } from "../packages/impact/traceDependencies";
import type { ModuleInfo } from "../packages/shared/types";

function makeModule(id: string, importedBy: string[] = [], imports: string[] = []): ModuleInfo {
  return {
    id,
    file: { relativePath: id } as any,
    exports: [],
    resolvedReExports: {},
    importedBy,
    imports,
  } as ModuleInfo;
}

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

    // test.ts <- consumer.ts (consumer.ts imports test.ts)
    repo.addModule(makeModule("test.ts", ["consumer.ts"], []));
    repo.addModule(makeModule("consumer.ts", [], ["test.ts"]));

    // circular.ts imports itself indirectly, buat test guard cycle
    repo.addModule(makeModule("circular.ts", ["circular.ts"], ["circular.ts"]));
  });

  it("calculateAffectedFiles should return ImpactResult with affectedFiles array", () => {
    const result = calculateAffectedFiles(repo, "test.ts");
    expect(result.notFound).toBe(false);
    expect(Array.isArray(result.affectedFiles)).toBe(true);
    expect(result.totalAffected).toBe(result.affectedFiles.length);
  });

  it("calculateAffectedFiles should handle non-existent module gracefully", () => {
    const result = calculateAffectedFiles(repo, "nonexistent.ts");
    expect(result.notFound).toBe(true);
    expect(result.affectedFiles).toEqual([]);
  });

  it("buildImpactTree should return tree structure", () => {
    const tree = buildImpactTree(repo, "test.ts");
    expect(tree).toHaveProperty("moduleId");
    expect(tree).toHaveProperty("children");
  });

  it("traceConsumers should return ConsumerTraceResult", () => {
    const result = traceConsumers(repo, "test.ts");
    expect(result).toHaveProperty("direct");
    expect(result).toHaveProperty("transitive");
    expect(Array.isArray(result.direct)).toBe(true);
  });

  it("traceDependencies should return DependencyTraceResult", () => {
    const result = traceDependencies(repo, "consumer.ts");
    expect(result).toHaveProperty("direct");
    expect(result).toHaveProperty("transitive");
    expect(Array.isArray(result.direct)).toBe(true);
  });

  it("buildImpactTree should guard against circular dependencies", () => {
    expect(() => {
      buildImpactTree(repo, "circular.ts");
    }).not.toThrow();
  });
});
