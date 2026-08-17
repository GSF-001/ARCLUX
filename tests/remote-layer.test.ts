import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createArchiveAcquirer, createRepositoryAcquirer, createSourceAcquirer } from "../packages/acquisition";
import { createRemoteAccess, createRemoteLocator, createRemoteProvider, createRemoteRevision } from "../packages/remote";
import { createRemoteImpactReport, createSourceHealthReport } from "../packages/remote-analysis";
import { analyzeRemoteRequest } from "../packages/remote-analysis/analyzeRemoteSource";
import { createRemoteAnalysisRequest } from "../packages/remote-analysis/RemoteAnalysisRequest";

describe("remote acquisition contracts", () => {
  it("rejects remote sources when policy disallows them", async () => {
    const result = await createSourceAcquirer().acquire("https://github.com/example/repo.git", { allowRemote: false });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("disabled");
  });

  it("creates a deterministic, sorted local snapshot", async () => {
    const result = await createSourceAcquirer("tests/fixtures/security-leaks").acquire();
    expect(result.ok).toBe(true);
    expect(result.snapshot?.files).toEqual(["app.ts", "safe.ts"]);
  });

  it("keeps repository and archive acquirers honest about their inputs", async () => {
    expect((await createRepositoryAcquirer().acquire("not-a-repository")).ok).toBe(false);
    expect((await createArchiveAcquirer().acquire("not-an-archive" as string)).ok).toBe(false);
  });

  it("accepts an absolute local directory path (Windows drive-letter form included)", async () => {
    // Regression: Node's `new URL("D:/...")` yields protocol "d:" without throwing,
    // so Windows drive-letter paths never hit the statSync fallback — the
    // `security` CLI command rejected every local Windows path. On POSIX the
    // tmp path has no scheme and falls back to statSync as before.
    const tmpDir = mkdtempSync(path.join(tmpdir(), "arclux-acq-"));
    try {
      const result = await createRepositoryAcquirer().acquire(tmpDir);
      expect(result.ok).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("remote metadata", () => {
  it("classifies providers and immutable revisions", () => {
    expect(createRemoteProvider("https://github.com/GSF-001/ARCLUX").name).toBe("github");
    expect(createRemoteRevision("a1b2c3d").immutable).toBe(true);
    expect(createRemoteRevision("main").immutable).toBe(false);
    expect(createRemoteLocator("https://github.com/GSF-001/ARCLUX").host).toBe("github.com");
  });

  it("enforces host allowlists", () => {
    expect(createRemoteAccess("https://github.com/GSF-001/ARCLUX", ["gitlab.com"]).allowed).toBe(false);
  });
});

describe("remote reports", () => {
  it("summarizes source health and empty impact safely", () => {
    expect(createSourceHealthReport("local", { ok: true, files: 2, parsedFiles: 2 }).skippedFiles).toBe(0);
    expect(createRemoteImpactReport("local").affectedFiles).toEqual([]);
    expect(createRemoteImpactReport("local").severity).toBe("none");
  });

  it("returns a correlated failure for a missing analysis source", async () => {
    const result = await analyzeRemoteRequest(createRemoteAnalysisRequest());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("source is required");
  });
});
