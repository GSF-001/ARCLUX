/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourceBoundaryPolicy } from "../packages/boundaries/SourceBoundaryPolicy";
import { RemoteAccessPolicy } from "../packages/boundaries/RemoteAccessPolicy";
import { AnalysisBoundary } from "../packages/boundaries/AnalysisBoundary";
import { EvidenceBoundary } from "../packages/boundaries/EvidenceBoundary";

describe("SourceBoundaryPolicy", () => {
  it("classifies sources", () => {
    const policy = new SourceBoundaryPolicy();
    expect(policy.classify("/home/user/repo")).toBe("local");
    expect(policy.classify("~/repo")).toBe("local");
    expect(policy.classify("https://github.com/foo/bar.git")).toBe("remote-git");
    expect(policy.classify("ftp://host/file")).toBe("unknown");
  });

  it("allows local paths and remote git by default", () => {
    const policy = new SourceBoundaryPolicy();
    expect(policy.check("/home/user/repo")).toEqual([]);
    expect(policy.check("https://github.com/foo/bar.git")).toEqual([]);
  });

  it("rejects remote when allowRemote is false", () => {
    const policy = new SourceBoundaryPolicy({ allowRemote: false });
    expect(policy.check("https://github.com/foo/bar.git")).toHaveLength(1);
  });

  it("enforces allowed roots and deny roots", () => {
    const root = mkdtempSync(join(tmpdir(), "arclux-bounds-"));
    const outside = mkdtempSync(join(tmpdir(), "arclux-other-"));
    mkdirSync(join(root, "private"), { recursive: true });
    mkdirSync(join(root, "app"), { recursive: true });
    const policy = new SourceBoundaryPolicy({ allowedRoots: [root], denyRoots: [join(root, "private")] });
    expect(policy.check(join(root, "app"))).toEqual([]);
    expect(policy.check(join(root, "private", "x"))).toHaveLength(1);
    expect(policy.check(join(outside, "x"))).toHaveLength(1);
  });

  it("rejects symlink escapes from allowed roots", () => {
    const root = mkdtempSync(join(tmpdir(), "arclux-bounds-"));
    const outside = mkdtempSync(join(tmpdir(), "arclux-outside-"));
    const link = join(root, "escape");
    try {
      symlinkSync(outside, link);
    } catch {
      return; // symlinks unsupported on this fs — nothing to assert
    }
    const policy = new SourceBoundaryPolicy({ allowedRoots: [root] });
    expect(policy.check(link)).toHaveLength(1);
    expect(policy.check(join(root, "app"))).toEqual([]);
  });

  it("assert throws on first violation", () => {
    const policy = new SourceBoundaryPolicy({ allowRemote: false });
    expect(() => policy.assert("https://github.com/foo/bar.git")).toThrow(/remote git sources are disabled/);
  });
});

describe("RemoteAccessPolicy", () => {
  const policy = RemoteAccessPolicy.default();

  it("allows public git hosts", () => {
    expect(policy.check("https://github.com/foo/bar.git")).toEqual([]);
    expect(policy.check("ssh://git@github.com/foo/bar.git")).toEqual([]);
  });

  it("allows any public https host, not just github", () => {
    expect(policy.check("https://gitlab.com/group/repo.git")).toEqual([]);
    expect(policy.check("https://bitbucket.org/user/repo.git")).toEqual([]);
    expect(policy.check("https://example.com/archive.tar.gz")).toEqual([]);
  });

  it("blocks private networks (SSRF guard)", () => {
    expect(policy.check("http://127.0.0.1:3000/repo.git")).toHaveLength(1);
    expect(policy.check("http://10.0.0.5/repo.git")).toHaveLength(1);
    expect(policy.check("http://192.168.1.10/repo.git")).toHaveLength(1);
    expect(policy.check("http://172.16.0.1/repo.git")).toHaveLength(1);
    expect(policy.check("http://169.254.169.254/latest/meta-data/")).toHaveLength(1);
    expect(policy.check("http://[::1]/repo.git")).toHaveLength(1);
  });

  it("blocks disallowed protocols", () => {
    expect(policy.check("ftp://example.com/repo.git")).toHaveLength(1);
  });

  it("enforces host allowlists and blocklists", () => {
    const restricted = new RemoteAccessPolicy({ allowedHosts: ["github.com"], blockedHosts: ["evil.com"] });
    expect(restricted.check("https://github.com/foo/bar.git")).toEqual([]);
    expect(restricted.check("https://gitlab.com/foo/bar.git")).toHaveLength(1);
    const blocked = new RemoteAccessPolicy({ blockedHosts: ["github.com"] });
    expect(blocked.check("https://github.com/foo/bar.git")).toHaveLength(1);
  });

  it("rejects oversized URLs", () => {
    const small = new RemoteAccessPolicy({ maxUrlLength: 20 });
    expect(small.check("https://github.com/foo/bar.git")).toHaveLength(1);
  });
});

describe("AnalysisBoundary", () => {
  it("flags denied paths", () => {
    const boundary = new AnalysisBoundary();
    expect(boundary.isDeniedPath("app/node_modules/x/index.js")).toBe(true);
    expect(boundary.isDeniedPath("src/.git/config")).toBe(true);
    expect(boundary.isDeniedPath("src/app.ts")).toBe(false);
  });

  it("enforces caps against a scan summary", () => {
    const boundary = new AnalysisBoundary({ maxFiles: 10, maxModules: 5 });
    expect(boundary.checkScan({ filesScanned: 5, filesParsed: 5, moduleCount: 4 })).toEqual([]);
    const violations = boundary.checkScan({ filesScanned: 12, filesParsed: 12, moduleCount: 8 });
    expect(violations).toHaveLength(2);
  });

  it("honors extra denied segments", () => {
    const boundary = new AnalysisBoundary({ extraDeniedSegments: ["generated"] });
    expect(boundary.isDeniedPath("src/generated/types.ts")).toBe(true);
  });
});

describe("EvidenceBoundary", () => {
  it("redacts secrets", () => {
    const boundary = new EvidenceBoundary();
    expect(boundary.redact("token=sk_live_abcDEF1234567890XYZ end")).toContain("[REDACTED:token]");
    expect(boundary.redact("password=sup3rSecret123456")).toContain("[REDACTED");
    expect(boundary.redact("api_key: abcdef0123456789abcdef")).toContain("[REDACTED:api key]");
    expect(boundary.redact("AKIAIOSFODNN7EXAMPLE")).toContain("[REDACTED:aws key]");
    expect(boundary.redact("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U")).toContain("[REDACTED:bearer]");
    expect(boundary.redact("-----BEGIN RSA PRIVATE KEY----- material")).toContain("[REDACTED:private key]");
    expect(boundary.redact("plain message without secrets")).not.toContain("REDACTED");
  });

  it("caps findings per check and trims long messages", () => {
    const boundary = new EvidenceBoundary({ maxFindingsPerCheck: 2, maxMessageLength: 20 });
    const findings = [
      { checkId: "a", message: "one" },
      { checkId: "a", message: "two" },
      { checkId: "a", message: "three" },
      { checkId: "b", message: "four" },
      { checkId: "b", message: "this message is much longer than twenty characters" },
    ];
    const capped = boundary.cap(findings);
    expect(capped.filter((f) => f.checkId === "a")).toHaveLength(2);
    expect(capped.filter((f) => f.checkId === "b")).toHaveLength(2);
    expect(capped.find((f) => f.checkId === "b" && f.message.startsWith("this message"))?.message.length).toBe(21);
  });
});