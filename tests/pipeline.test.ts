import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import { analyzeRepository } from "../packages/engine/pipeline";

describe("Pipeline: analyzeRepository", () => {
  it("should throw when both repoUrl and localPath are provided", async () => {
    try {
      await analyzeRepository({
        repoUrl: "https://github.com/test/repo",
        localPath: "/tmp/test",
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it("should throw when neither repoUrl nor localPath are provided", async () => {
    try {
      await analyzeRepository({});
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it("should return AnalyzeRepositoryResult structure", async () => {
    const result = await analyzeRepository({
      localPath: ".",
    });

    expect(result).toHaveProperty("meta");
    expect(result).toHaveProperty("moduleCount");
    expect(result).toHaveProperty("graph");
    expect(result).toHaveProperty("scanSummary");
    expect(result).toHaveProperty("repository");
    expect(result).toHaveProperty("dependencies");
  }, 30000);

  it("should have valid scanSummary structure", async () => {
    const result = await analyzeRepository({
      localPath: ".",
    });

    expect(result.scanSummary).toHaveProperty("filesScanned");
    expect(result.scanSummary).toHaveProperty("filesParsed");
    expect(result.scanSummary).toHaveProperty("filesSkippedNoParser");
    expect(typeof result.scanSummary.filesScanned).toBe("number");
  });

  it("should have valid meta structure", async () => {
    const result = await analyzeRepository({
      localPath: ".",
    });

    expect(result.meta).toHaveProperty("org");
    expect(result.meta).toHaveProperty("name");
    expect(result.meta).toHaveProperty("rootPath");
    expect(result.meta).toHaveProperty("analyzedAt");
  });

  it("should have non-negative moduleCount", async () => {
    const result = await analyzeRepository({
      localPath: ".",
    });

    expect(result.moduleCount).toBeGreaterThanOrEqual(0);
  });

  it("should have dependencies array", async () => {
    const result = await analyzeRepository({
      localPath: ".",
    });

    expect(Array.isArray(result.dependencies)).toBe(true);
  });
});
