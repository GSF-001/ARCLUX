// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Registry-driven bindings: the bridge between the ARCLUX scripting
// language and the engine. Every capability the language exposes comes
// from a real engine function — nothing here is fake.
//
// Auto-discovery: `buildBindings()` queries the ParserRegistry for
// registered extensions and exposes the doctor checkId table, so a
// parser or detector added later becomes available in the language with
// zero DSL changes. That's the "the language grows with ARCLUX" property.

import { parserRegistry } from "../parser/core/ParserRegistry";
import { analyzeRepository, ensureParsersRegistered } from "../engine/pipeline";
import { runDoctor, type DoctorFinding } from "../engine/runDoctor";
import { buildDependencyGraph } from "../graph/buildDependencyGraph";
import { buildCallGraph } from "../graph/buildCallGraph";
import { calculateAffectedFiles } from "../impact/calculateAffectedFiles";
import { buildSearchIndex } from "../search/SearchIndex";
import { search as runSearch } from "../search/SearchEngine";
import { analyzeRepositorySecurity } from "../security-analysis/integration";
import { adaptSource } from "../adapters";
import { getChangedFiles } from "../diff/gitDiff";
import { computeArchitecturalDiff } from "../diff/architecturalDiff";
import type { Repository } from "../repository/Repository";
import type { ArcluxValue, ArcluxNativeFn, RuntimeContext } from "./runtime";
import { stringify } from "./runtime";

/**
 * Doctor checkIds wired into runDoctor's built-in suite. The DSL exposes
 * `check("<id>")` so scripts can target a single detector. Kept in sync
 * with runDoctor.ts — the source of truth is the detector wiring there.
 */
export const DOCTOR_CHECK_IDS = [
  "circularDependency",
  "unusedExports",
  "orphanFiles",
  "orphanIntegration",
  "layerViolation",
  "ambiguousSymbolResolution",
  "largeModules",
  "duplicateModules",
  "indexFiles",
  "deadCode",
  "componentConvention",
  "featureStructure",
  "missingExports",
  "repositoryPattern",
  "routeConvention",
  "storyConvention",
  "testConvention",
  "unusedFiles",
] as const;

export type DoctorCheckId = (typeof DOCTOR_CHECK_IDS)[number];

/** Registry-aware list of supported source extensions (parserRegistry). */
export function registeredExtensions(): string[] {
  ensureParsersRegistered();
  return [...parserRegistry.registeredExtensions].sort();
}

function native(
  name: string,
  fn: (args: ArcluxValue[], ctx: RuntimeContext) => Promise<ArcluxValue> | ArcluxValue
): ArcluxNativeFn {
  return { kind: "native", name, fn: (args, ctx) => Promise.resolve(fn(args, ctx)) };
}

function arg(args: ArcluxValue[], i: number, name: string): ArcluxValue {
  if (i >= args.length) throw new Error(`Missing argument "${name}"`);
  return args[i];
}

function str(args: ArcluxValue[], i: number, name: string): string {
  const v = arg(args, i, name);
  if (typeof v !== "string") throw new Error(`Argument "${name}" must be a string`);
  return v;
}

function findingsToValues(findings: DoctorFinding[]): ArcluxValue[] {
  return findings.map((f) => ({
    checkId: f.checkId,
    severity: f.severity,
    filePath: f.filePath ?? "",
    message: f.message,
    classification: (f.detail?.classification as string | undefined) ?? "",
    evidence: (f.detail?.evidence as string[] | undefined) ?? [],
    suggestedImporters: (f.detail?.suggestedImporters as ArcluxValue[] | undefined) ?? [],
  }));
}

function securityToValues(analysis: unknown): ArcluxValue {
  const a = analysis as {
    findings?: Array<{ severity: string; title: string; filePath?: string; message?: string }>;
    summary?: Record<string, unknown>;
  };
  const findings = a.findings ?? [];
  return {
    findingCount: findings.length,
    findings: findings.map((f) => ({
      severity: f.severity,
      title: f.title,
      filePath: f.filePath ?? "",
      message: f.message ?? "",
    })),
  };
}

// Repos analyzed inside one script run are held here by their meta id so
// later builtins (doctor/impact/graph/...) can resolve them. NEVER put
// the Repository object inside a script value — it serializes to {}.
const repoHandles = new Map<string, Repository>();

function registerRepoHandle(repo: Repository): void {
  repoHandles.set(repo.meta.id, repo);
}

async function resolveRepo(args: ArcluxValue[], index: number, argName: string): Promise<Repository> {
  const v = arg(args, index, argName);
  if (typeof v === "string") {
    const result = await analyzeRepository({ localPath: v });
    registerRepoHandle(result.repository);
    return result.repository;
  }
  if (v && typeof v === "object" && typeof (v as Record<string, unknown>).repoId === "string") {
    const repoId = (v as Record<string, unknown>).repoId as string;
    const handle = repoHandles.get(repoId);
    if (handle) return handle;
    throw new Error(`Repo "${repoId}" not found in this run — pass a path string instead`);
  }
  throw new Error(`Argument "${argName}" must be a repo value from analyze() or a path string`);
}

function repoToValues(repo: Repository): ArcluxValue {
  const modules = repo.getAllModules();
  return {
    repoId: repo.meta.id,
    meta: {
      id: repo.meta.id,
      org: repo.meta.org,
      name: repo.meta.name,
      rootPath: repo.meta.rootPath,
      defaultBranch: repo.meta.defaultBranch,
      detectedFrameworks: repo.meta.detectedFrameworks,
    },
    moduleCount: modules.length,
    modules: modules.map((m) => ({
      id: m.id,
      path: m.file.relativePath,
      extension: m.file.extension,
      language: m.file.language,
      imports: m.imports,
      importedBy: m.importedBy,
      exports: m.exports.map((e) => e.name),
    })),
  };
}

/**
 * Build the language's function table — pure engine access, nothing fake.
 */
export async function buildBindings(): Promise<Record<string, ArcluxNativeFn>> {
  const b: Record<string, ArcluxNativeFn> = {};

  // ── core: analysis pipeline ──────────────────────────────────────────
  b.analyze = native("analyze", async (args, ctx) => {
    const target = str(args, 0, "target");
    const adapted = adaptSource(target);
    const result = adapted.url
      ? await analyzeRepository({ repoUrl: adapted.url })
      : await analyzeRepository({ localPath: adapted.localPath! });
    registerRepoHandle(result.repository);
    ctx.log("info", `analyzed ${result.repository.meta.name}: ${result.moduleCount} modules`);
    return repoToValues(result.repository);
  });

  b.doctor = native("doctor", async (args) => {
    const repo = await resolveRepo(args, 0, "repo");
    const result = runDoctor(repo);
    return {
      findings: findingsToValues(result.findings),
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      infoCount: result.infoCount,
      total: result.findings.length,
    };
  });

  b.check = native("check", async (args) => {
    const checkId = str(args, 0, "checkId");
    if (!(DOCTOR_CHECK_IDS as readonly string[]).includes(checkId)) {
      throw new Error(`Unknown check "${checkId}" — available: ${DOCTOR_CHECK_IDS.join(", ")}`);
    }
    const repo = await resolveRepo(args, 1, "repo");
    const result = runDoctor(repo);
    return findingsToValues(result.findings.filter((f) => f.checkId === checkId));
  });

  b.graph = native("graph", async (args) => {
    const repo = await resolveRepo(args, 0, "repo");
    const graph = buildDependencyGraph(repo);
    return {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      nodeIds: graph.nodes.map((n) => n.id),
    };
  });

  b.callgraph = native("callgraph", async (args) => {
    const repo = await resolveRepo(args, 0, "repo");
    const graph = buildCallGraph(repo);
    return { nodes: graph.nodes.length, edges: graph.edges.length };
  });

  b.impact = native("impact", async (args) => {
    const repo = await resolveRepo(args, 0, "repo");
    const file = str(args, 1, "file");
    const result = calculateAffectedFiles(repo, file);
    return {
      file: result.changedModuleId,
      notFound: result.notFound,
      direct: result.affectedFiles.filter((f) => f.distance === 1).length,
      affected: result.totalAffected,
      files: result.affectedFiles.map((f) => ({ id: f.moduleId, path: f.filePath, distance: f.distance })),
    };
  });

  b.search = native("search", async (args) => {
    const repo = await resolveRepo(args, 0, "repo");
    const query = str(args, 1, "query");
    const index = buildSearchIndex(repo);
    const results = runSearch(index, query, { limit: 25 });
    return results.map((r) => ({ id: r.moduleId, path: r.filePath, score: r.score }));
  });

  b.security = native("security", async (args) => {
    const repo = await resolveRepo(args, 0, "repo");
    return securityToValues(analyzeRepositorySecurity(repo));
  });

  // ── diff ─────────────────────────────────────────────────────────────
  b.diff = native("diff", async (args) => {
    const repoPath = str(args, 0, "repoPath");
    const refA = str(args, 1, "refA");
    const refB = str(args, 2, "refB");
    const changed = getChangedFiles(repoPath, refA, refB);
    return changed.map((c) => ({
      path: c.path,
      status: c.status,
    }));
  });

  b.archdiff = native("archdiff", async (args) => {
    const repo = await resolveRepo(args, 0, "repo");
    const repoPath = str(args, 1, "repoPath");
    const refA = str(args, 2, "refA");
    const refB = str(args, 3, "refB");
    const result = computeArchitecturalDiff(repo, repoPath, refA, refB);
    const byStatus: Record<string, number> = {};
    for (const f of result.changedFiles) {
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    }
    return {
      changedFiles: result.changedFiles.length,
      affectedFiles: result.affectedFiles.length,
      byStatus,
    };
  });

  // ── language surface ─────────────────────────────────────────────────
  b.len = native("len", (args) => {
    const v = arg(args, 0, "value");
    if (Array.isArray(v)) return v.length;
    if (typeof v === "string") return v.length;
    if (v && typeof v === "object" && !("kind" in v)) return Object.keys(v as object).length;
    throw new Error("len() expects a list, string, or object");
  });

  b.print = native("print", (args, ctx) => {
    ctx.stdout(args.map((a) => stringify(a)).join(" "));
    return null;
  });

  b.log = native("log", (args, ctx) => {
    const level = str(args, 0, "level");
    const message = stringify(arg(args, 1, "message"));
    ctx.log(level, message);
    return null;
  });

  b.sum = native("sum", (args) => {
    const list = arg(args, 0, "list");
    if (!Array.isArray(list)) throw new Error("sum() expects a list");
    return list.reduce<number>((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
  });

  b.mean = native("mean", (args) => {
    const list = arg(args, 0, "list");
    if (!Array.isArray(list)) throw new Error("mean() expects a list");
    const nums = list.filter((v): v is number => typeof v === "number");
    return nums.length ? nums.reduce((a, v) => a + v, 0) / nums.length : 0;
  });

  b.max = native("max", (args) => {
    const list = arg(args, 0, "list");
    if (!Array.isArray(list)) throw new Error("max() expects a list");
    const nums = list.filter((v): v is number => typeof v === "number");
    return nums.length ? Math.max(...nums) : 0;
  });

  b.min = native("min", (args) => {
    const list = arg(args, 0, "list");
    if (!Array.isArray(list)) throw new Error("min() expects a list");
    const nums = list.filter((v): v is number => typeof v === "number");
    return nums.length ? Math.min(...nums) : 0;
  });

  b.sort = native("sort", (args) => {
    const list = arg(args, 0, "list");
    if (!Array.isArray(list)) throw new Error("sort() expects a list");
    const byKey = typeof args[1] === "string" ? args[1] : null;
    return [...list].sort((a, z) => {
      if (typeof a === "number" && typeof z === "number") return a - z;
      const sa = byKey ? stringify((a as Record<string, ArcluxValue>)?.[byKey] ?? "") : stringify(a);
      const sz = byKey ? stringify((z as Record<string, ArcluxValue>)?.[byKey] ?? "") : stringify(z);
      return sa.localeCompare(sz);
    });
  });

  b.filter = native("filter", (args) => {
    const list = arg(args, 0, "list");
    if (!Array.isArray(list)) throw new Error("filter() expects a list");
    const key = typeof args[1] === "string" ? args[1] : null;
    const op = typeof args[2] === "string" ? args[2] : "==";
    const expected = args[3];
    if (expected === undefined) throw new Error("filter() needs a value to compare against");
    return list.filter((item) => {
      const actual = key ? (item as Record<string, ArcluxValue>)?.[key] : item;
      switch (op) {
        case "==":
          return actual === expected;
        case "!=":
          return actual !== expected;
        case ">":
          return typeof actual === "number" && typeof expected === "number" && actual > expected;
        case "<":
          return typeof actual === "number" && typeof expected === "number" && actual < expected;
        case ">=":
          return typeof actual === "number" && typeof expected === "number" && actual >= expected;
        case "<=":
          return typeof actual === "number" && typeof expected === "number" && actual <= expected;
        case "in":
          return stringify(actual).includes(stringify(expected));
        default:
          throw new Error(`Unknown filter operator "${op}"`);
      }
    });
  });

  b.keys = native("keys", (args) => {
    const v = arg(args, 0, "object");
    if (!v || typeof v !== "object" || "kind" in v) throw new Error("keys() expects an object");
    return Object.keys(v as object);
  });

  b.values = native("values", (args) => {
    const v = arg(args, 0, "object");
    if (!v || typeof v !== "object" || "kind" in v) throw new Error("values() expects an object");
    return Object.values(v as Record<string, ArcluxValue>);
  });

  b.first = native("first", (args) => {
    const v = arg(args, 0, "list");
    return Array.isArray(v) && v.length ? v[0] : null;
  });

  b.last = native("last", (args) => {
    const v = arg(args, 0, "list");
    return Array.isArray(v) && v.length ? v[v.length - 1] : null;
  });

  b.exists = native("exists", (args) => {
    const list = arg(args, 0, "list");
    const key = typeof args[1] === "string" ? args[1] : null;
    const expected = args[2];
    if (!Array.isArray(list)) throw new Error("exists() expects a list");
    return list.some((item) => {
      const actual = key ? (item as Record<string, ArcluxValue>)?.[key] : item;
      return actual === expected;
    });
  });

  // ── type / coercion ──────────────────────────────────────────────────
  b.type = native("type", (args) => {
    const v = arg(args, 0, "value");
    if (v === null) return "null";
    if (Array.isArray(v)) return "list";
    if (typeof v === "object" && "kind" in v) return "function";
    if (typeof v === "object") return "object";
    return typeof v;
  });

  b.tostr = native("tostr", (args) => stringify(arg(args, 0, "value")));
  b.tonum = native("tonum", (args) => {
    const v = arg(args, 0, "value");
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isNaN(n)) throw new Error(`Cannot convert "${v}" to number`);
      return n;
    }
    throw new Error(`Cannot convert ${typeof v} to number`);
  });

  // ── env / misc ───────────────────────────────────────────────────────
  b.env = native("env", (args) => {
    const key = str(args, 0, "key");
    return process.env[key] ?? null;
  });

  b.cwd = native("cwd", () => process.cwd());

  b.extensions = native("extensions", () => registeredExtensions());

  b.checkids = native("checkids", () => [...DOCTOR_CHECK_IDS]);

  return b;
}