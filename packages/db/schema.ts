// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// packages/db/ was 0% (no database dependency installed -- confirmed via
// package.json/node_modules, no sqlite/lowdb/knex/prisma/drizzle present,
// and this session has no network access to `pnpm add` one). Rather than
// write code against a library that isn't installed (unverifiable, same
// mistake as the VS Code extension caveat), this uses a JSON-file-per-record
// store through packages/storage/RecoveryManager.ts's writeTransactional()
// (the write-ahead journal already built and verified this session) --
// no new dependency, works today, crash-safe by construction.
//
// SCHEMA_VERSION exists so a future real SQL migration can detect "this
// repo has old JSON-store data" and write a one-time importer, instead of
// silently ignoring it.

export const SCHEMA_VERSION = 1;

export interface RepoRecord {
  id: string;
  org: string;
  name: string;
  defaultBranch: string;
  rootPath: string;
  detectedFrameworks: string[];
  packageManager: "npm" | "pnpm" | "yarn" | "poetry" | "uv" | "pipenv" | "pdm" | "pip" | "unknown";
  analyzedAt: string;
}

export interface AnalysisRecord {
  id: string;
  repoId: string;
  moduleCount: number;
  nodeCount: number;
  edgeCount: number;
  analyzedAt: string;
}

export interface IssueRecord {
  id: string;
  repoId: string;
  analysisId: string;
  source: "detector" | "rule";
  checkId: string;
  severity: "error" | "warning";
  message: string;
  createdAt: string;
}

export type CollectionName = "repos" | "analyses" | "issues";
