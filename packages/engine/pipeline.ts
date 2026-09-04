// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { randomUUID } from "node:crypto";
import path from "node:path";
import { cloneRepository } from "../git/cloneRepository";
import { cleanupRepository } from "../git/cleanupRepository";
import { buildIndex } from "../indexer/buildIndex";
import { buildDependencyGraph } from "../graph/buildDependencyGraph";
import { parserRegistry } from "../parser/core/ParserRegistry";
import { parseTs } from "../parser/typescript/parseTs";
import { parsePython } from "../parser/python/parsePython";
import { parseJs } from "../parser/javascript/parseJs";
import { parseJsx } from "../parser/javascript/parseJsx";
import { parseCommonJs } from "../parser/javascript/parseCommonJs";
import { parseGo } from "../parser/go/parseGo";
import { parseJava } from "../parser/java/parseJava";
import { parsePhp } from "../parser/php/parsePhp";
import { parseRuby } from "../parser/ruby/parseRuby";
import { parseRust } from "../parser/rust/parseRust";
import { parseCpp } from "../parser/cpp/parseCpp";
import { parseCSharp } from "../parser/csharp/parseCSharp";
import { parseBash } from "../parser/bash/parseBash";
import { parseC } from "../parser/c/parseC";
import { parseDart } from "../parser/dart/parseDart";
import { parseElixir } from "../parser/elixir/parseElixir";
import { parseKotlin } from "../parser/kotlin/parseKotlin";
import { parseLua } from "../parser/lua/parseLua";
import { parseObjc } from "../parser/objc/parseObjc";
import { parseOcaml } from "../parser/ocaml/parseOcaml";
import { parseScala } from "../parser/scala/parseScala";
import { parseSolidity } from "../parser/solidity/parseSolidity";
import { parseSwift } from "../parser/swift/parseSwift";
import { parseVue } from "../parser/vue/parseVue";
import { parseZig } from "../parser/zig/parseZig";
import { parseElm } from "../parser/elm/parseElm";
import { parseRescript } from "../parser/rescript/parseRescript";
import { manifestRegistry } from "../parser/core/ManifestRegistry";
import { scanFiles } from "../parser/core/scanFiles";
import { computeRepositoryFingerprint, getCachedRepository, setCachedRepository } from "../cache/repositoryCache";
import { getCachedGraph, setCachedGraph } from "../cache/graphCache";
import { parsePackageJson } from "../parser/config/parsePackageJson";
import { parseGoMod } from "../parser/go/parseGoMod";
import { parseCargoToml } from "../parser/rust/parseCargoToml";
import { parseGemfile } from "../parser/ruby/parseGemfile";
import { parseComposer } from "../parser/php/parseComposer";
import { parseCsproj } from "../parser/csharp/parseCsproj";
import { parseGradle_, parsePom } from "../parser/java/parseGradlePom";
import { parseRequirements } from "../parser/python/parseRequirements";
import { detectFrameworks, detectPackageManager } from "./detectRepositoryMeta";
import { getHeadState } from "../git/headFreshness";
import { ArcluxError, isArcluxError } from "../shared/errors";
import type { DependencyGraph, RepositoryMeta, ScanSummary } from "../shared/types";
import type { Repository } from "../repository/Repository";
import { analyzeRepositorySecurity } from "../security-analysis/integration";
import type { SecurityAnalysis } from "../security-analysis/SecurityAnalysis";

// Register known parsers once, at module load. As more languages get parser
// implementations (parseJs, parsePython, ...) they get registered here too.
let parsersRegistered = false;
export function ensureParsersRegistered() {
  if (parsersRegistered) return;
  parserRegistry.register(parseTs);
  parserRegistry.register(parsePython);
  parserRegistry.register(parseJs);
  parserRegistry.register(parseJsx);
  parserRegistry.register(parseCommonJs);
  parserRegistry.register(parseGo);
  parserRegistry.register(parseJava);
  parserRegistry.register(parsePhp);
  parserRegistry.register(parseRuby);
  parserRegistry.register(parseRust);
  parserRegistry.register(parseCpp);
  parserRegistry.register(parseCSharp);
  parserRegistry.register(parseBash);
  parserRegistry.register(parseC);
  parserRegistry.register(parseDart);
  parserRegistry.register(parseElixir);
  parserRegistry.register(parseKotlin);
  parserRegistry.register(parseLua);
  parserRegistry.register(parseObjc);
  parserRegistry.register(parseOcaml);
  parserRegistry.register(parseScala);
  parserRegistry.register(parseSolidity);
  parserRegistry.register(parseSwift);
  parserRegistry.register(parseVue);
  parserRegistry.register(parseZig);
  parserRegistry.register(parseElm);
  parserRegistry.register(parseRescript);

  manifestRegistry.register(parsePackageJson);
  manifestRegistry.register(parseGoMod);
  manifestRegistry.register(parseCargoToml);
  manifestRegistry.register(parseGemfile);
  manifestRegistry.register(parseComposer);
  manifestRegistry.register(parseCsproj);
  manifestRegistry.register(parseGradle_);
  manifestRegistry.register(parsePom);
  manifestRegistry.register(parseRequirements);

  parsersRegistered = true;
}

export interface AnalyzeRepositoryOptions {
  /**
   * Remote repo to clone-analyze-cleanup. Provide this OR localPath,
   * never both — analyzeRepository() throws if both or neither are set.
   */
  repoUrl?: string;
  /**
   * A directory already on disk to analyze directly — no clone, no
   * cleanup, no cache (see analyzeLocalPath()'s comment for why no
   * cache). This is the CLI use case (arclux diff/verify/doctor/etc
   * pointed at a local checkout).
   */
  localPath?: string;
  branch?: string;
}

export interface AnalyzeRepositoryResult {
  meta: RepositoryMeta;
  moduleCount: number;
  graph: DependencyGraph;
  /**
   * Scan accounting — files scanned vs parsed vs skipped (no parser for
   * the language). The population-rot guard: tells consumers how much of
   * the repo actually made it into the graph (see ScanSummary).
   */
  scanSummary: ScanSummary;
  /**
   * Full in-memory Repository, for server-side consumers that need to run
   * detectors/impact analysis (CLI, /api/impact, /api/search) without
   * re-indexing. NEVER JSON.stringify this directly or spread it into an
   * API response — Repository stores modules in a private Map, which
   * serializes to an empty {} (silent data loss, not a crash). Route
   * handlers must derive a plain-object shape from it first (see
   * calculateAffectedFiles usage in api/impact/route.ts for the pattern).
   */
  repository: Repository;
  /** Combined dependency list from every manifest file present in the repo (package.json, go.mod, etc). See ManifestRegistry.ts. */
  dependencies: import("../parser/core/ManifestParserInterface").ManifestDependency[];
  securityAnalysis?: SecurityAnalysis;
}

/** Parses "org/name" out of a git URL, for https, ssh, and shorthand forms */
export function parseOrgAndName(repoUrl: string): { org: string; name: string } {
  const cleaned = repoUrl.replace(/\.git$/, "");
  const match = cleaned.match(/[:/]([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new ArcluxError({
      code: "CLONE_FAILED",
      message: `Could not parse org/repo name from URL: ${repoUrl}`,
    });
  }
  return { org: match[1], name: match[2] };
}

/**
 * The single entry point for "analyze this repo". Everything else (CLI command,
 * API route, future queue worker) should call THIS, not the individual steps —
 * that keeps clone/cleanup lifecycle correct in exactly one place.
 *
 * LAB 3 (2026-08-11): merged in what used to be apps/cli/analyzeLocal.ts,
 * a separate local-path-only orchestration path that duplicated most of
 * this file's logic (documented as a known, intentional gap in its own
 * header comment — this merge is that gap being closed). Two behavior
 * changes as a direct result, both intentional:
 *   1. Local-path analysis (CLI) now registers all 7 language parsers +
 *      9 manifest parsers, same as the remote flow. Previously
 *      analyzeLocal.ts only registered parseTs + parsePython — JS/JSX/
 *      CommonJS/Go/Java files were silently unparsed for every CLI
 *      command (diff, verify, doctor, impact, graph, analyze, config).
 *   2. Local-path analysis returns the full AnalyzeRepositoryResult
 *      shape (includes `dependencies` now), not the narrower
 *      LocalAnalysisResult analyzeLocal.ts used to return.
 */
export async function analyzeRepository(
  options: AnalyzeRepositoryOptions
): Promise<AnalyzeRepositoryResult> {
  ensureParsersRegistered();

  if (options.localPath && options.repoUrl) {
    throw new Error("analyzeRepository: provide either repoUrl or localPath, not both.");
  }

  if (options.localPath) {
    return analyzeLocalPath(options.localPath);
  }

  if (!options.repoUrl) {
    throw new Error("analyzeRepository: repoUrl or localPath is required.");
  }

  return analyzeRemoteRepository(options.repoUrl, options.branch);
}

/**
 * Local-path flow: no git clone, no cleanup, no cache.
 *
 * No caching on purpose: the fingerprint/cache system (repositoryCache.ts,
 * graphCache.ts) is keyed by repoUrl+branch, which doesn't map cleanly to
 * a bare local directory a developer is actively editing. Caching stale
 * results mid-edit would be worse than the cost of re-indexing. Revisit
 * if `arclux` commands feel slow on large local repos — that's a real
 * possible follow-up, not ruled out, just not built here.
 */
async function analyzeLocalPath(localPath: string): Promise<AnalyzeRepositoryResult> {
  const resolvedPath = path.resolve(localPath);
  // Freshness stamp (ManSio #22 line): git head at build time, so readers
  // holding this result can evaluateFreshness() before trusting it.
  // Never throws (non-git -> null stamp -> INCONCLUSIVE downstream).
  const head = await getHeadState(resolvedPath);

  const meta: RepositoryMeta = {
    id: "local",
    org: "local",
    name: path.basename(resolvedPath),
    defaultBranch: "local",
    rootPath: resolvedPath,
    detectedFrameworks: detectFrameworks(resolvedPath),
    packageManager: detectPackageManager(resolvedPath),
    analyzedAt: new Date().toISOString(),
    buildHead: head.isRepo ? { commit: head.commit, dirty: head.dirty } : null,
  };

  let repository: Repository;
  try {
    repository = await buildIndex({ rootPath: resolvedPath, meta });
  } catch (err) {
    throw isArcluxError(err)
      ? err
      : new ArcluxError({ code: "INDEX_FAILED", message: "Indexing failed", cause: err });
  }

  let graph: DependencyGraph;
  try {
    graph = buildDependencyGraph(repository);
  } catch (err) {
    throw new ArcluxError({
      code: "GRAPH_BUILD_FAILED",
      message: "Graph construction failed",
      cause: err,
    });
  }

  return {
    meta: repository.meta,
    moduleCount: repository.moduleCount,
    graph,
    scanSummary: repository.scanSummary ?? {
      filesScanned: 0,
      filesParsed: 0,
      filesSkippedNoParser: 0,
      skippedByExtension: {},
    },
    repository,
    dependencies: manifestRegistry.detectDependencies(resolvedPath),
    securityAnalysis: analyzeRepositorySecurity(repository, resolvedPath),
  };
}

/**
 * Remote-URL flow: clone → index → graph → cache → cleanup.
 * Behavior unchanged from before LAB 3 — this is the pre-existing logic,
 * only extracted into its own named function so analyzeRepository() can
 * route to it or to analyzeLocalPath() based on options.
 */
async function analyzeRemoteRepository(
  repoUrl: string,
  branch?: string
): Promise<AnalyzeRepositoryResult> {
  const { org, name } = parseOrgAndName(repoUrl);
  let localPath: string | undefined;

  try {
    const cloneResult = await cloneRepository({ repoUrl, branch });
    localPath = cloneResult.localPath;

    const head = await getHeadState(localPath);

    const meta: RepositoryMeta = {
      id: randomUUID(),
      org,
      name,
      defaultBranch: cloneResult.branch,
      rootPath: localPath,
      detectedFrameworks: detectFrameworks(localPath),
      packageManager: detectPackageManager(localPath),
      analyzedAt: new Date().toISOString(),
      buildHead: head.isRepo ? { commit: head.commit, dirty: head.dirty } : null,
    };

    // Cheap up-front scan (hashing only, not parsing) to compute a
    // fingerprint of the repo's current content. If it matches what we
    // cached last time for this repoUrl+branch, skip the expensive
    // buildIndex/buildDependencyGraph work entirely. See
    // progres/decisions.md's cache research entries for why this is
    // content-hash based rather than git-diff based.
    const scannedFiles = scanFiles(localPath);
    const fingerprint = computeRepositoryFingerprint(scannedFiles);

    let repository: Repository;
    let graph: DependencyGraph;

    const cachedRepository = getCachedRepository(repoUrl, meta.defaultBranch, fingerprint);
    const cachedGraph = getCachedGraph(repoUrl, meta.defaultBranch, fingerprint);

    if (cachedRepository && cachedGraph) {
      repository = cachedRepository;
      graph = cachedGraph;
    } else {
      try {
        repository = await buildIndex({ rootPath: localPath, meta });
      } catch (err) {
        throw isArcluxError(err)
          ? err
          : new ArcluxError({ code: "INDEX_FAILED", message: "Indexing failed", cause: err });
      }

      try {
        graph = buildDependencyGraph(repository);
      } catch (err) {
        throw new ArcluxError({
          code: "GRAPH_BUILD_FAILED",
          message: "Graph construction failed",
          cause: err,
        });
      }

      setCachedRepository(repoUrl, meta.defaultBranch, fingerprint, repository);
      setCachedGraph(repoUrl, meta.defaultBranch, fingerprint, graph);
    }

    return {
      meta: repository.meta,
      moduleCount: repository.moduleCount,
      graph,
      scanSummary: repository.scanSummary ?? {
        filesScanned: 0,
        filesParsed: 0,
        filesSkippedNoParser: 0,
        skippedByExtension: {},
      },
      repository,
      dependencies: manifestRegistry.detectDependencies(localPath),
      securityAnalysis: analyzeRepositorySecurity(repository, localPath),
    };
  } finally {
    // Always clean up the temp clone, even if analysis threw partway through.
    if (localPath) {
      await cleanupRepository(localPath).catch(() => {
        // best-effort — don't let a cleanup failure mask the real error
      });
    }
  }
}
