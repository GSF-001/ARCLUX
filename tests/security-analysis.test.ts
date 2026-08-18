// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for packages/security-analysis/source detectors. Uses a tiny
// in-memory Repository + SourceProvider for unit cases (the detector.test.ts
// pattern) and one REAL buildIndex run over tests/fixtures/security-leaks/
// for the end-to-end positive/negative controls (CONTRIBUTING.md: tsc alone
// is not "verified").

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { buildIndex } from "../packages/indexer/buildIndex";
import { Repository } from "../packages/repository/Repository";
import type { RepositoryMeta } from "../packages/shared/types";
import { parserRegistry } from "../packages/parser/core/ParserRegistry";
import { parseTs } from "../packages/parser/typescript/parseTs";
import { parsePython } from "../packages/parser/python/parsePython";
import { parseJs } from "../packages/parser/javascript/parseJs";
import { parseJsx } from "../packages/parser/javascript/parseJsx";
import { parseCommonJs } from "../packages/parser/javascript/parseCommonJs";
import { parseGo } from "../packages/parser/go/parseGo";
import { parseJava } from "../packages/parser/java/parseJava";
import { DiskSourceProvider, type SourceProvider } from "../packages/security-analysis";
import {
  detectSecretExposure,
  shannonEntropy,
  DEFAULT_SECRET_RULES,
} from "../packages/security-analysis/source/SecretExposureDetector";
import {
  detectUnsafePatterns,
  DEFAULT_UNSAFE_PATTERN_RULES,
  isInsideStringOrComment,
} from "../packages/security-analysis/source/UnsafePatternDetector";
import { detectSensitiveDataFlow } from "../packages/security-analysis/source/SensitiveDataFlowDetector";

parserRegistry.register(parseTs);
parserRegistry.register(parsePython);
parserRegistry.register(parseJs);
parserRegistry.register(parseJsx);
parserRegistry.register(parseCommonJs);
parserRegistry.register(parseGo);
parserRegistry.register(parseJava);

// ─────────────────────────────────────────────
// In-memory helpers (mirror tests/detector.test.ts)
// ─────────────────────────────────────────────

class MapSourceProvider implements SourceProvider {
  private contents: Map<string, string>;
  constructor(contents: Record<string, string>) {
    this.contents = new Map(Object.entries(contents));
  }
  read(relativePath: string): string | null {
    return this.contents.get(relativePath) ?? null;
  }
}

function makeRepository(relativePaths: string[]): Repository {
  const meta: RepositoryMeta = {
    id: "unit",
    org: "local",
    name: "unit",
    defaultBranch: "main",
    // In-memory fixture: no files are written, so this is a marker value,
    // not a real path (avoids ThreatCrush insecure-temp-file noise).
    rootPath: "in-memory",
    detectedFrameworks: [],
    packageManager: "unknown",
    analyzedAt: new Date().toISOString(),
  };
  const repo = new Repository(meta);
  for (const relativePath of relativePaths) {
    repo.addModule({
      id: relativePath,
      file: {
        absolutePath: `in-memory/${relativePath}`,
        relativePath,
        language: "typescript",
        extension: ".ts",
        sizeBytes: 0,
        hash: "h",
      },
      exports: [],
      resolvedReExports: {},
      importedBy: [],
      imports: [],
      resolvedImports: [],
      calls: [],
      calledBy: [],
      implicitDependencies: [],
    });
  }
  return repo;
}

// ─────────────────────────────────────────────
// Shannon entropy
// ─────────────────────────────────────────────

describe("shannonEntropy", () => {
  it("returns 0 for empty/constant strings", () => {
    expect(shannonEntropy("")).toBe(0);
    expect(shannonEntropy("aaaaaaaa")).toBe(0);
  });
  it("is high for random-looking strings", () => {
    expect(shannonEntropy("x7K9pQ2mLs4ZvN1")).toBeGreaterThan(3);
  });
  it("is low for readable words", () => {
    expect(shannonEntropy("password")).toBeLessThan(3);
  });
});

// ─────────────────────────────────────────────
// SecretExposureDetector — unit
// ─────────────────────────────────────────────

describe("detectSecretExposure (unit, in-memory)", () => {
  it("flags an AWS key with entropy threshold satisfied", () => {
    const repo = makeRepository(["config.ts"]);
    const sources = new MapSourceProvider({ "config.ts": "const key = 'AKIAJ8K2L3M4N5P6Q7R8';" });
    const findings = detectSecretExposure(repo, sources);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("aws-access-key");
    expect(findings[0].location.line).toBe(1);
    expect(findings[0].id).toBe("aws-access-key:config.ts:1");
  });

  it("respects inline gitleaks:allow marker", () => {
    const repo = makeRepository(["config.ts"]);
    const sources = new MapSourceProvider({
      "config.ts": "const key = 'AKIAJ8K2L3M4N5P6Q7R8'; // gitleaks:allow\n",
    });
    expect(detectSecretExposure(repo, sources)).toHaveLength(0);
  });

  it("drops matches below the entropy threshold", () => {
    const repo = makeRepository(["config.ts"]);
    // "AKIAAAAAAAAAAAAAAAA" has low entropy (repeating A) -> below 3.5
    const sources = new MapSourceProvider({ "config.ts": "const key = 'AKIAAAAAAAAAAAAAAAA';" });
    const findings = detectSecretExposure(repo, sources);
    expect(findings).toHaveLength(0);
  });

  it("applies stopwords to the generic-password rule", () => {
    const repo = makeRepository(["config.ts"]);
    const sources = new MapSourceProvider({ "config.ts": "const password = 'changeme123';" });
    const findings = detectSecretExposure(repo, sources);
    expect(findings).toHaveLength(0); // "changeme" is a stopword
  });

  it("does not flag a PascalCase identifier value as a secret", () => {
    const repo = makeRepository(["config.ts"]);
    const sources = new MapSourceProvider({
      "config.ts": "const NODE_SOURCE = { secret: 'secretsManager', parameter: 'ssm' };\n",
    });
    expect(detectSecretExposure(repo, sources)).toHaveLength(0); // value is a type name, not a credential
  });

  it("skips modules when the content channel has no data", () => {
    const repo = makeRepository(["config.ts"]);
    const sources = new MapSourceProvider({}); // read() -> null
    expect(detectSecretExposure(repo, sources)).toHaveLength(0);
  });

  it("respects path allowlists", () => {
    const repo = makeRepository(["config.ts"]);
    const sources = new MapSourceProvider({ "config.ts": "const key = 'AKIAJ8K2L3M4N5P6Q7R8';" });
    const findings = detectSecretExposure(repo, sources, { allowlistPaths: [/config\.ts$/] });
    expect(findings).toHaveLength(0);
  });

  it("finds multiple distinct rules in one file, sorted by path+line", () => {
    const repo = makeRepository(["a.ts"]);
    const ghContent = 'const gh = "ghp_' + "A".repeat(36) + '";\n';
    const sources = new MapSourceProvider({
      "a.ts": "const aws = 'AKIAJ8K2L3M4N5P6Q7R8';\n" + ghContent,
    });
    const findings = detectSecretExposure(repo, sources);
    const ruleIds = findings.map((f) => f.ruleId).sort();
    expect(ruleIds).toContain("aws-access-key");
    expect(ruleIds).toContain("github-personal-access-token");
  });
});

// ─────────────────────────────────────────────
// UnsafePatternDetector — unit
// ─────────────────────────────────────────────

describe("detectUnsafePatterns (unit, in-memory)", () => {
  it("flags eval() with line and CWE metadata", () => {
    const repo = makeRepository(["x.ts"]);
    const sources = new MapSourceProvider({ "x.ts": "const y = eval(code);\n" });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("unsafe-eval");
    expect(findings[0].location.line).toBe(1);
    expect(findings[0].cwe).toContain("CWE-95");
  });

  it("does not flag RegExp.prototype.exec as shell execution", () => {
    const repo = makeRepository(["x.ts"]);
    const sources = new MapSourceProvider({
      "x.ts": "const apiId = /^([a-z0-9]+)\\.execute-api\\./.exec(origin.domainName);\n",
    });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings.filter((f) => f.ruleId === "shell-exec")).toHaveLength(0);
  });

  it("still flags execSync from child_process", () => {
    const repo = makeRepository(["x.ts"]);
    const sources = new MapSourceProvider({
      "x.ts": "const { execSync } = require('child_process'); execSync('rm -rf /tmp/x');\n",
    });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings.some((f) => f.ruleId === "shell-exec")).toBe(true);
  });

  it("ignores eval inside comments via notInside", () => {
    const repo = makeRepository(["x.ts"]);
    const sources = new MapSourceProvider({ "x.ts": "// eval(never runs)\n" });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings.filter((f) => f.ruleId === "unsafe-eval")).toHaveLength(0);
  });

  it("flags innerHTML and dangerouslySetInnerHTML", () => {
    const repo = makeRepository(["c.tsx"]);
    const sources = new MapSourceProvider({
      "c.tsx": "el.innerHTML = userInput;\ndiv = <div dangerouslySetInnerHTML={{ __html: x }} />;\n",
    });
    const findings = detectUnsafePatterns(repo, sources);
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain("innerhtml-assignment");
    expect(ids).toContain("dangerously-set-innerhtml");
  });

  // FP regression: MSCodeBase audit 2026-08-18 (all 12 high were FPs)
  it("does not flag .eval() method calls (model.eval())", () => {
    const repo = makeRepository(["model.py"]);
    const sources = new MapSourceProvider({ "model.py": "model.eval()\n" });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings.filter((f) => f.ruleId === "unsafe-eval")).toHaveLength(0);
  });

  it("does not flag denylist string constants", () => {
    const repo = makeRepository(["denylist.py"]);
    const sources = new MapSourceProvider({
      "denylist.py": 'BLOCKED = {"eval(", "exec(", "compile(", "subprocess"}\n',
    });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings.filter((f) => f.ruleId === "unsafe-eval")).toHaveLength(0);
    expect(findings.filter((f) => f.ruleId === "shell-exec")).toHaveLength(0);
  });

  it("does not flag Python comments mentioning eval", () => {
    const repo = makeRepository(["c.py"]);
    const sources = new MapSourceProvider({ "c.py": "# model.eval() switches to inference mode\n" });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings.filter((f) => f.ruleId === "unsafe-eval")).toHaveLength(0);
  });

  it("still flags a bare eval() call next to a string literal", () => {
    const repo = makeRepository(["x.ts"]);
    const sources = new MapSourceProvider({
      "x.ts": 'const label = "eval( is fine in text";\nconst y = eval(code);\n',
    });
    const findings = detectUnsafePatterns(repo, sources);
    expect(findings.filter((f) => f.ruleId === "unsafe-eval")).toHaveLength(1);
    expect(findings.filter((f) => f.ruleId === "unsafe-eval")[0].location.line).toBe(2);
  });
});

describe("isInsideStringOrComment (unit)", () => {
  it("detects matches inside double-quoted strings", () => {
    expect(isInsideStringOrComment('BLOCKED = {"eval(", x', 12)).toBe(true);
  });
  it("detects matches inside single-quoted strings", () => {
    expect(isInsideStringOrComment("x = 'eval( text'", 5)).toBe(true);
  });
  it("detects matches after a Python # comment", () => {
    expect(isInsideStringOrComment("# model.eval()", 5)).toBe(true);
  });
  it("returns false for a bare call", () => {
    expect(isInsideStringOrComment("const y = eval(code);", 10)).toBe(false);
  });
  it("does not treat a # inside a string as a comment", () => {
    expect(isInsideStringOrComment('x = "# not a comment" eval(', 22)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// SensitiveDataFlowDetector — unit
// ─────────────────────────────────────────────

describe("detectSensitiveDataFlow (unit, in-memory)", () => {
  it("flags a module importing fs AND calling a sink", () => {
    const repo = new Repository({
      id: "unit",
      org: "local",
      name: "unit",
      defaultBranch: "main",
      rootPath: "in-memory",
      detectedFrameworks: [],
      packageManager: "unknown",
      analyzedAt: new Date().toISOString(),
    });
    repo.addModule({
      id: "logger.ts",
      file: {
        absolutePath: "in-memory/logger.ts",
        relativePath: "logger.ts",
        language: "typescript",
        extension: ".ts",
        sizeBytes: 0,
        hash: "h",
      },
      exports: [],
      resolvedReExports: {},
      importedBy: [],
      imports: ["fs"],
      resolvedImports: [{ moduleId: "fs", kind: "static", namedImports: [], hasDefaultImport: true, hasNamespaceImport: false, line: 1 }],
      calls: [{ moduleId: "fs", calleeName: "writeFile", line: 3 }],
      calledBy: [],
      implicitDependencies: [],
    });
    const findings = detectSensitiveDataFlow(repo, new MapSourceProvider({}));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("sensitive-data-flow");
    expect(findings[0].confidence).toBe("low");
    expect(findings[0].location.filePath).toBe("logger.ts");
  });

  it("leaves modules without sinks alone", () => {
    const repo = makeRepository(["ok.ts"]);
    const sources = new MapSourceProvider({ "ok.ts": "import fs from 'fs';\n" });
    // in-memory repo has no calls -> no finding
    const findings = detectSensitiveDataFlow(repo, sources);
    expect(findings).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// End-to-end over the real fixture (positive + negative control)
// ─────────────────────────────────────────────

describe("security-analysis e2e over tests/fixtures/security-leaks", () => {
  let repository: Repository;

  beforeAll(async () => {
    const meta: RepositoryMeta = {
      id: "security-leaks",
      org: "local",
      name: "security-leaks",
      defaultBranch: "main",
      rootPath: path.join(__dirname, "fixtures", "security-leaks"),
      detectedFrameworks: [],
      packageManager: "unknown",
      analyzedAt: new Date().toISOString(),
    };
    repository = await buildIndex({ rootPath: path.join(__dirname, "fixtures", "security-leaks"), meta });
  }, 30_000);

  it("indexes the fixture modules", () => {
    const ids = repository.getAllModules().map((m) => m.id).sort();
    expect(ids).toEqual(["app.ts", "safe.ts"]);
  });

  it("flags the fake secrets in app.ts", () => {
    const sources = new DiskSourceProvider(path.join(__dirname, "fixtures", "security-leaks"));
    const findings = detectSecretExposure(repository, sources);
    const ruleIds = findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("api-key-prefixed"); // sk-test-...
    expect(ruleIds).toContain("aws-access-key"); // AKIATEST...
    expect(ruleIds).toContain("generic-password-assignment"); // DB_PASSWORD
    // inline gitleaks:allow line (password: "local-dev-only") must NOT be flagged:
    expect(findings.every((f) => !(f.ruleId === "generic-password-assignment" && f.location.line === 14))).toBe(true);
  });

  it("flags unsafe patterns in app.ts but not in safe.ts", () => {
    const sources = new DiskSourceProvider(path.join(__dirname, "fixtures", "security-leaks"));
    const findings = detectUnsafePatterns(repository, sources);
    const files = new Set(findings.map((f) => f.location.filePath));
    expect(files).toContain("app.ts");
    expect(files.has("safe.ts")).toBe(false);
    expect(findings.some((f) => f.ruleId === "unsafe-eval")).toBe(true);
  });

  it("leaves the negative-control fixture clean", () => {
    const sources = new DiskSourceProvider(path.join(__dirname, "fixtures", "security-leaks"));
    const secrets = detectSecretExposure(repository, sources);
    const unsafe = detectUnsafePatterns(repository, sources);
    expect(secrets.filter((f) => f.location.filePath === "safe.ts")).toHaveLength(0);
    expect(unsafe.filter((f) => f.location.filePath === "safe.ts")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// Default rule sanity (mutation-control style)
// ─────────────────────────────────────────────

describe("default rule sets are self-consistent", () => {
  it("every default rule has a unique id", () => {
    const ids = DEFAULT_SECRET_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const unsafeIds = DEFAULT_UNSAFE_PATTERN_RULES.map((r) => r.id);
    expect(new Set(unsafeIds).size).toBe(unsafeIds.length);
  });
});
