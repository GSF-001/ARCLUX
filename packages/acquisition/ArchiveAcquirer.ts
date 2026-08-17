// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { AcquisitionPolicy } from "./AcquisitionPolicy";
import type { AcquisitionResult } from "./AcquisitionResult";
import { assertSourceAllowed, resolveAcquisitionPolicy } from "./AcquisitionPolicy";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize, relative, resolve } from "node:path";

const execFileAsync = promisify(execFile);

export interface ArchiveAcquirer {
  id: string;
  source?: string;
  metadata?: Record<string, unknown>;
  acquire(source?: string, policy?: Partial<AcquisitionPolicy>): Promise<AcquisitionResult>;
}

export function createArchiveAcquirer(source?: string): ArchiveAcquirer {
  return {
    id: randomUUID(),
    source,
    metadata: { kind: "archive" },
    async acquire(requestedSource = source, policy) {
      if (!requestedSource || !isArchiveSource(requestedSource)) {
        return {
          ok: false,
          errors: ["Archive acquisition requires a .zip, .tar, .tar.gz, or .tgz source."],
        };
      }

      const resolvedPolicy = resolveAcquisitionPolicy(policy);
      let workspace: string | undefined;
      try {
        assertSourceAllowed(requestedSource, resolvedPolicy);
        workspace = await mkdtemp(join(tmpdir(), "arclux-archive-"));
        const archivePath = await materializeArchive(requestedSource, workspace, resolvedPolicy);
        const entries = await listEntries(archivePath, archiveFormat(requestedSource));
        validateEntries(entries);

        const extractedPath = join(workspace, "source");
        await extractArchive(archivePath, extractedPath, archiveFormat(requestedSource));
        const files = await collectSafeFiles(extractedPath, resolvedPolicy.maxBytes);
        const extractedBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
        if (extractedBytes > resolvedPolicy.maxBytes) {
          throw new Error(`Extracted archive exceeds acquisition limit (${extractedBytes} > ${resolvedPolicy.maxBytes} bytes).`);
        }

        return {
          ok: true,
          errors: [],
          snapshot: {
            id: randomUUID(),
            source: requestedSource,
            createdAt: new Date().toISOString(),
            files: files.map((file) => file.relativePath).sort(),
          },
        };
      } catch (error) {
        return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
      } finally {
        if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}

function isArchiveSource(source: string): boolean {
  return /\.(?:zip|tar|tar\.gz|tgz)(?:[?#].*)?$/i.test(source);
}

type ArchiveFormat = "zip" | "tar";

function archiveFormat(source: string): ArchiveFormat {
  return /\.zip(?:[?#].*)?$/i.test(source) ? "zip" : "tar";
}

async function materializeArchive(
  source: string,
  workspace: string,
  policy: AcquisitionPolicy,
): Promise<string> {
  const archivePath = join(workspace, `archive${archiveFormat(source) === "zip" ? ".zip" : ".tar"}`);
  if (!/^https?:\/\//i.test(source)) {
    const info = await stat(source);
    if (!info.isFile()) throw new Error("Archive source must be a file.");
    if (info.size > policy.maxBytes) throw new Error(`Archive exceeds acquisition limit (${info.size} > ${policy.maxBytes} bytes).`);
    await writeFile(archivePath, await readFile(source));
    return archivePath;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
  try {
    const response = await fetch(source, { signal: controller.signal });
    if (!response.ok) throw new Error(`Archive download failed with HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > policy.maxBytes) throw new Error(`Archive exceeds acquisition limit (${contentLength} > ${policy.maxBytes} bytes).`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength > policy.maxBytes) throw new Error(`Archive exceeds acquisition limit (${data.byteLength} > ${policy.maxBytes} bytes).`);
    await writeFile(archivePath, data);
    return archivePath;
  } finally {
    clearTimeout(timer);
  }
}

async function listEntries(archivePath: string, format: ArchiveFormat): Promise<string[]> {
  const args = format === "zip" ? ["-Z1", archivePath] : ["-tf", archivePath];
  const { stdout } = await execFileAsync(format === "zip" ? "unzip" : "tar", args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function validateEntries(entries: string[]): void {
  for (const entry of entries) {
    const normalized = normalize(entry.replaceAll("\\", "/"));
    if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith(`..${normalize("/")}`)) {
      throw new Error(`Archive contains unsafe path: ${entry}`);
    }
  }
}

async function extractArchive(archivePath: string, destination: string, format: ArchiveFormat): Promise<void> {
  await mkdir(destination, { recursive: true });
  const args = format === "zip"
    ? ["-q", archivePath, "-d", destination]
    : ["--no-same-owner", "--no-same-permissions", "-xf", archivePath, "-C", destination];
  await execFileAsync(format === "zip" ? "unzip" : "tar", args, { maxBuffer: 10 * 1024 * 1024 });
}

interface AcquiredFile {
  relativePath: string;
  sizeBytes: number;
}

async function collectSafeFiles(root: string, maxBytes: number): Promise<AcquiredFile[]> {
  const rootPath = resolve(root);
  const files: AcquiredFile[] = [];
  let totalBytes = 0;

  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name);
      const relativePath = relative(rootPath, absolutePath);
      if (relativePath === "" || relativePath.startsWith("..")) {
        throw new Error(`Extracted path escaped archive root: ${entry.name}`);
      }
      const info = await lstat(absolutePath);
      if (info.isSymbolicLink()) throw new Error(`Archive contains a symbolic link: ${relativePath}`);
      if (info.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!info.isFile()) continue;
      totalBytes += info.size;
      if (totalBytes > maxBytes) throw new Error(`Extracted archive exceeds acquisition limit (${totalBytes} > ${maxBytes} bytes).`);
      files.push({ relativePath: relativePath.replaceAll("\\", "/"), sizeBytes: info.size });
    }
  }

  await walk(rootPath);
  return files;
}
