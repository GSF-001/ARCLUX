// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for issue #349: packages/workspace/ ties project + environment +
// services + processes into one session concept.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorkspaceManager } from "../packages/workspace/WorkspaceManager";
import { WorkspaceSession } from "../packages/workspace/WorkspaceSession";
import { Kernel } from "../packages/kernel/Kernel";
import { ProcessStatus } from "../packages/shared/types";

let dirs: string[] = [];

function makeRepo(sub = "repo"): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-ws-"));
  const root = join(dir, sub);
  mkdirSync(join(root, ".git"), { recursive: true });
  dirs.push(dir);
  // Return a path INSIDE the repo dir so detectRepositoryRoot walks up to it.
  return root;
}

function makeRepoRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "arclux-ws-"));
  mkdirSync(join(dir, ".git"));
  dirs.push(dir);
  return dir;
}

function cleanup(): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
}

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe("WorkspaceManager (issue #349)", () => {
  it("detects the repository root walking up from a subfolder", () => {
    const sub = makeRepo("nested");
    const manager = new WorkspaceManager();
    const session = manager.open(join(sub, "deep", "deeper"));

    const state = session.getState();
    expect(state.repositoryRoot).toBe(sub);
    expect(state.wasStartPath).toBe(false);
    expect(state.status).toBe("active");
  });

  it("returns the same session for the same root (idempotent open)", () => {
    const root = makeRepoRoot();
    const manager = new WorkspaceManager();
    const a = manager.open(root);
    const b = manager.open(root);

    expect(a).toBe(b);
    expect(manager.list()).toHaveLength(1);
  });

  it("open falls back to startPath when no .git is found", () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-ws-nogit-"));
    dirs.push(dir);
    const manager = new WorkspaceManager();
    const session = manager.open(dir);

    expect(session.getState().repositoryRoot).toBe(dir);
    expect(session.getState().wasStartPath).toBe(true);
  });

  it("close removes the session and shuts down its kernel", () => {
    const root = makeRepoRoot();
    const manager = new WorkspaceManager();
    const session = manager.open(root);
    const kernel = session.kernel;

    expect(manager.close(root)).toBe(true);
    expect(manager.get(root)).toBeUndefined();
    // After kernel.shutdown() the signal bus is cleared; a state read shows closed.
    expect(session.getState().status).toBe("closed");
    expect(kernel.processTable.list()).toEqual([]);
  });

  it("snapshots capture processes and services immutably", () => {
    const root = makeRepoRoot();
    const manager = new WorkspaceManager();
    const session = manager.open(root);

    session.registerProcess({
      id: "svc-1",
      name: "demo",
      command: process.execPath,
      args: ["-e", ""],
    });
    session.registerService({ name: "demo", processId: "svc-1", registeredAt: Date.now() });

    const snap = session.snapshot();
    expect(snap.state.repositoryRoot).toBe(root);
    expect(snap.processes).toHaveLength(1);
    expect(snap.processes[0]).toMatchObject({ id: "svc-1", status: ProcessStatus.LAUNCHING });
    expect(snap.services).toHaveLength(1);

    // Snapshot is immutable: mutating the source table doesn't change it.
    session.kernel.removeProcess("svc-1");
    expect(snap.processes).toHaveLength(1);
  });
});

describe("WorkspaceSession (issue #349)", () => {
  it("close is idempotent", () => {
    const session = new WorkspaceSession({
      rootPath: "/virtual/repo",
      repositoryRoot: "/virtual/repo",
      wasStartPath: true,
    });
    session.close();
    session.close();
    expect(session.status).toBe("closed");
  });

  it("setError marks the session errored and records the message", () => {
    const session = new WorkspaceSession({
      rootPath: "/virtual/repo",
      repositoryRoot: "/virtual/repo",
      wasStartPath: true,
    });
    session.setError(new Error("analysis failed"));

    expect(session.status).toBe("error");
    expect(session.getState().error).toBe("analysis failed");
    expect(session.getState().closedAt).not.toBeNull();
  });

  it("accepts an injected kernel (test seam)", () => {
    const kernel = new Kernel();
    const session = new WorkspaceSession({
      rootPath: "/virtual/repo",
      repositoryRoot: "/virtual/repo",
      wasStartPath: true,
      kernel,
    });
    expect(session.kernel).toBe(kernel);
  });

  it("registerService throws on duplicate names (ServiceRegistry contract)", () => {
    const session = new WorkspaceSession({
      rootPath: "/virtual/repo",
      repositoryRoot: "/virtual/repo",
      wasStartPath: true,
    });
    session.registerService({ name: "dup", processId: "a", registeredAt: 1 });
    expect(() => session.registerService({ name: "dup", processId: "b", registeredAt: 2 })).toThrow(
      /already registered/
    );
  });
});
