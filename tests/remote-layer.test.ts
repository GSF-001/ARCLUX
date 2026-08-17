import { describe, expect, it } from "vitest";
import { createSourceAcquirer } from "../packages/acquisition";
import { createRemoteAccess, createRemoteLocator, createRemoteProvider, createRemoteRevision } from "../packages/remote";
import { createRemoteImpactReport, createSourceHealthReport } from "../packages/remote-analysis";

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
});
