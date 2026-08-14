// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for issue #351: packages/terminal/ is a managed shell execution
// layer — runs commands through Sandbox capability checks instead of
// calling child_process directly, and records each run as a session.

import { describe, it, expect } from "vitest";
import { CommandExecutor } from "../packages/terminal/CommandExecutor";
import { TerminalManager } from "../packages/terminal/TerminalManager";
import { buildShellEnvironment } from "../packages/terminal/ShellEnvironment";
import { Sandbox } from "../packages/security/Sandbox";
import { PermissionManager } from "../packages/security/PermissionManager";
import { Capability, type CapabilityValue } from "../packages/security/Capability";
import type { ProcessSpec } from "../packages/runtime/ProcessSpec";

// process.execPath so tests pass on any platform without assuming `node` on PATH.
function nodeSpec(overrides: Partial<ProcessSpec> = {}): ProcessSpec {
  return {
    id: "test",
    name: "test",
    command: process.execPath,
    args: ["-e", "console.log('hi')"],
    ...overrides,
  };
}

function grantedSandbox(caps: CapabilityValue[] = [Capability.EXEC, Capability.ENV_WRITE], id = "test") {
  const permissions = new PermissionManager();
  permissions.grant(id, caps);
  return new Sandbox(permissions);
}

describe("ShellEnvironment", () => {
  it("merges overrides on top of the process env", () => {
    const env = buildShellEnvironment({ ARCLUX_TEST: "1" });
    expect(env.ARCLUX_TEST).toBe("1");
    // Base process env is still there (PATH at minimum).
    expect(Object.keys(env).length).toBeGreaterThan(0);
  });

  it("accepts no overrides (returns a copy of process.env)", () => {
    const env = buildShellEnvironment();
    expect(env.PATH ?? env.Path).toBeTruthy();
  });
});

describe("CommandExecutor (issue #351)", () => {
  it("runs a permitted command and captures stdout", async () => {
    const executor = new CommandExecutor(grantedSandbox());
    const result = await executor.execute(nodeSpec());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hi");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("captures stderr and non-zero exit code", async () => {
    const executor = new CommandExecutor(grantedSandbox());
    const result = await executor.execute(
      nodeSpec({ args: ["-e", "console.error('boom'); process.exit(3)"] })
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("boom");
  });

  it("kills a hung command after timeoutMs", async () => {
    const executor = new CommandExecutor(grantedSandbox());
    const started = Date.now();
    const result = await executor.execute(
      nodeSpec({ args: ["-e", "setTimeout(() => {}, 5000)"] }),
      { timeoutMs: 300 }
    );

    expect(Date.now() - started).toBeGreaterThanOrEqual(300);
    // SIGKILL means no clean exit code — but the promise must resolve, not hang.
    expect(result.exitCode).toBeNull();
  });

  it("rejects when the command binary does not exist (spawn error)", async () => {
    const executor = new CommandExecutor(grantedSandbox());
    await expect(
      executor.execute(nodeSpec({ command: "arclux-definitely-not-a-real-binary-xyz" }))
    ).rejects.toThrow();
  });

  it("denies a command without the EXEC capability (sandbox gate)", async () => {
    const executor = new CommandExecutor(grantedSandbox([Capability.FS_READ]));
    await expect(executor.execute(nodeSpec())).rejects.toThrow(/denied/);
  });

  it("denies a command whose capability set is not registered at all", async () => {
    const executor = new CommandExecutor(new Sandbox(new PermissionManager()));
    await expect(executor.execute(nodeSpec())).rejects.toThrow(/denied/);
  });
});

describe("TerminalManager (issue #351)", () => {
  it("runs a command and records the session with stdout", async () => {
    const manager = new TerminalManager();
    const session = await manager.run(nodeSpec());

    expect(session.status).toBe("exited");
    expect(session.exitCode).toBe(0);
    expect(session.stdout).toContain("hi");
    expect(manager.get("test")).toBe(session);
  });

  it("default-grants EXEC+ENV_WRITE so run() works without pre-granting", async () => {
    const manager = new TerminalManager();
    const session = await manager.run(nodeSpec({ id: "auto" }));
    expect(session.status).toBe("exited");
  });

  it("records sandbox denial as an errored session, not a silent drop", async () => {
    const manager = new TerminalManager({ defaultCapabilities: [Capability.FS_READ] });
    await expect(manager.run(nodeSpec())).rejects.toThrow(/denied/);

    const session = manager.get("test");
    expect(session?.status).toBe("error");
    expect(session?.stderr).toMatch(/denied/);
  });

  it("rejects duplicate session ids", async () => {
    const manager = new TerminalManager();
    await manager.run(nodeSpec());
    await expect(manager.run(nodeSpec())).rejects.toThrow(/already exists/);
  });

  it("records a missing-binary spawn error as an errored session", async () => {
    const manager = new TerminalManager();
    await expect(
      manager.run(nodeSpec({ id: "missing", command: "arclux-definitely-not-a-real-binary-xyz" }))
    ).rejects.toThrow();

    const session = manager.get("missing");
    expect(session?.status).toBe("error");
    expect(session?.exitCode).toBeNull();
  });

  it("lists recorded sessions", async () => {
    const manager = new TerminalManager();
    await manager.run(nodeSpec({ id: "one", args: ["-e", "console.log('1')"] }));
    await manager.run(nodeSpec({ id: "two", args: ["-e", "console.log('2')"] }));

    const ids = manager.list().map((s) => s.id);
    expect(ids).toEqual(["one", "two"]);
  });

  it("applies env overrides from the spec to the child", async () => {
    const manager = new TerminalManager();
    const session = await manager.run(
      nodeSpec({
        id: "envtest",
        args: ["-e", "console.log(process.env.ARCLUX_TERM_TEST)"],
        env: { ARCLUX_TERM_TEST: "from-spec" },
      })
    );
    expect(session.stdout).toContain("from-spec");
  });
});
