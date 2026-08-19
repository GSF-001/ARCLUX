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
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArcluxShell } from "../packages/shell/ArcluxShell";
import { loadPlugins } from "../packages/shell/plugins";
import { loadDetectors } from "../packages/shell/detectors";
import { RepositoryQuery } from "../packages/shell/query";
import { ShellSession } from "../packages/shell/session";

const repo = join(__dirname, "fixtures", "python-basic");

describe("ArcluxShell", () => {
  it("analyzes a repo and serves instant queries", async () => {
    const shell = new ArcluxShell();
    const analyze = await shell.handleCommand(repo);

    expect(analyze.output.join("\n")).toContain("Repository:");
    expect(analyze.output.join("\n")).toContain("Graph:");

    const graph = await shell.handleCommand("graph");
    expect(graph.output.join("\n")).toMatch(/\d+ nodes, \d+ edges/);

    const help = await shell.handleCommand("help");
    expect(help.output.join("\n")).toContain("impact <file>");
  });

  it("accepts a bare path as an analyze command", async () => {
    const shell = new ArcluxShell();
    const result = await shell.handleCommand(`${repo}/`);
    expect(result.output.join("\n")).toContain("Repository:");
  });

  it("reports no-repo errors before any analysis", async () => {
    const shell = new ArcluxShell();
    expect((await shell.handleCommand("impact src/index.ts")).output[0]).toContain("no repo");
    expect((await shell.handleCommand("doctor")).output[0]).toContain("no repo");
  });

  it("resolves modules for deps and consumers", async () => {
    const shell = new ArcluxShell();
    await shell.handleCommand(repo);
    const modules = shell["repository"]!.getAllModules();
    const first = modules[0];

    const deps = await shell.handleCommand(`deps ${first.id}`);
    expect(deps.output[0]).toMatch(/^imports \(\d+\):$/);

    const consumers = await shell.handleCommand(`consumers ${first.id}`);
    expect(consumers.output[0]).toMatch(/^imported by \(\d+\):$/);
  });

  it("runs doctor on an analyzed repo", async () => {
    const shell = new ArcluxShell();
    await shell.handleCommand(repo);
    const result = await shell.handleCommand("doctor");
    expect(result.output[0]).toMatch(/\d+ error\(s\)/);
  });

  it("searches the analyzed repo", async () => {
    const shell = new ArcluxShell();
    await shell.handleCommand(repo);
    const result = await shell.handleCommand("search app");
    expect(result.output.length).toBeGreaterThan(0);
  });

  it("exits on exit", async () => {
    const shell = new ArcluxShell();
    const result = await shell.handleCommand("exit");
    expect(result.exit).toBe(true);
  });

  it("reports the real system snapshot", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-system-"));
    cpSync(repo, dir, { recursive: true });
    const shell = new ArcluxShell();
    await shell.handleCommand(dir);
    const result = await shell.handleCommand("system");
    const out = result.output.join("\n");
    expect(out).toContain(`node: ${process.version}`);
    expect(out).toContain(`pid: ${process.pid}`);
    expect(out).toContain("status: active");
    expect(out).toContain(`repositoryRoot: ${dir}`);
  });

  it("runs user-space detectors alongside the built-in suite", async () => {
    const detectorsDir = mkdtempSync(join(tmpdir(), "arclux-detectors-"));
    writeFileSync(
      join(detectorsDir, "rule.ts"),
      `
        export default {
          checkId: "noUtilsImports",
          severity: "warning",
          run(repository) {
            return repository
              .getAllModules()
              .filter((m) => m.imports.some((id) => id.includes("utils")))
              .map((m) => ({ filePath: m.id, message: "imports utils — move to a shared package" }));
          },
        };
      `
    );
    const shell = new ArcluxShell(undefined, detectorsDir);
    await shell.handleCommand(repo);
    const result = await shell.handleCommand("doctor");
    const out = result.output.join("\n");
    expect(out).toContain("19 built-in + 1 user (noUtilsImports)");
    expect(out).toContain("noUtilsImports: 1");
  });

  it("passes args to plugins", async () => {
    const pluginsDir = mkdtempSync(join(tmpdir(), "arclux-plugins-"));
    writeFileSync(
      join(pluginsDir, "args.ts"),
      `
        export default {
          name: "args",
          run(ctx) { ctx.log(ctx.args.join("|")); },
        };
      `
    );
    const shell = new ArcluxShell(pluginsDir);
    await shell.handleCommand(repo);
    const result = await shell.handleCommand("run args one two three");
    expect(result.output[0]).toBe("one|two|three");
  });

  it("gives plugins the query surface and session snapshot", async () => {
    const pluginsDir = mkdtempSync(join(tmpdir(), "arclux-plugins-"));
    writeFileSync(
      join(pluginsDir, "q.ts"),
      `
        export default {
          name: "q",
          run(ctx) {
            ctx.log("modules=" + ctx.query.modules().length);
            ctx.log("status=" + ctx.session.workspace.state.status);
          },
        };
      `
    );
    const shell = new ArcluxShell(pluginsDir);
    await shell.handleCommand(repo);
    const result = await shell.handleCommand("run q");
    expect(result.output[0]).toMatch(/^modules=\d+$/);
    expect(result.output[1]).toBe("status=active");
  });

  it("turns watch on and off", async () => {
    const shell = new ArcluxShell();
    await shell.handleCommand(repo);

    expect(shell.watchActive).toBe(false);

    const on = await shell.handleCommand("watch on");
    expect(on.output[0]).toContain("watch on");
    expect(shell.watchActive).toBe(true);

    expect((await shell.handleCommand("watch on")).output[0]).toContain("already on");

    const off = await shell.handleCommand("watch off");
    expect(off.output[0]).toContain("watch off");
    expect(shell.watchActive).toBe(false);

    await shell.dispose();
  });

  it("requires a repo before watch", async () => {
    const shell = new ArcluxShell();
    expect((await shell.handleCommand("watch on")).output[0]).toContain("no repo");
  });

  it(
    "watch mode picks up a newly created file",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "arclux-watch-"));
      cpSync(repo, dir, { recursive: true });
      const shell = new ArcluxShell();
      await shell.handleCommand(dir);

      await shell.handleCommand("watch on");
      const before = (await shell.handleCommand("graph")).output[0];

      // chokidar drops events for files that appear DURING its initial scan
      // (ignoreInitial: true) — a real user is editing seconds after `watch
      // on`, so this race never matters in practice, but the test must wait
      // for the initial scan to settle before writing the new file.
      await new Promise((r) => setTimeout(r, 1500));
      writeFileSync(join(dir, "extra.py"), "import os\n\ndef extra():\n    return os.getpid()\n");

      const deadline = Date.now() + 15000;
      let after = before;
      while (Date.now() < deadline && after === before) {
        await new Promise((r) => setTimeout(r, 300));
        after = (await shell.handleCommand("graph")).output[0];
      }
      expect(after).not.toBe(before);

      await shell.dispose();
    },
    30000
  );
});

describe("loadDetectors", () => {
  it("loads detectors from a directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-detectors-"));
    writeFileSync(
      join(dir, "rule.ts"),
      `
        export default {
          checkId: "noOsImports",
          severity: "warning",
          run(repository) {
            const findings = [];
            for (const m of repository.getAllModules()) {
              if (m.imports.some((id) => id === "os" || id.startsWith("os."))) {
                findings.push({ filePath: m.id, message: "imports os — banned" });
              }
            }
            return findings;
          },
        };
      `
    );
    const detectors = await loadDetectors({ dir, fileNames: ["rule.ts"] });
    expect(detectors).toHaveLength(1);
    expect(detectors[0].checkId).toBe("noOsImports");
    expect(detectors[0].severity).toBe("warning");
    expect(detectors[0].filePath).toBe(join(dir, "rule.ts"));
  });
});

describe("RepositoryQuery", () => {
  it("answers structural questions over an analyzed repo", async () => {
    const shell = new ArcluxShell();
    await shell.handleCommand(repo);
    const query = new RepositoryQuery(shell["repository"]);

    expect(query.modules().length).toBeGreaterThan(0);

    const first = query.modules()[0];
    expect(query.module(first.id)).toBe(first);
    expect(query.importsOf(first.id).value).toEqual(first.imports);
    expect(query.consumersOf(first.id).value).toEqual(first.importedBy);

    for (const m of query.modules()) {
      expect(query.consumersOf(m.id).value.length).toBe(m.importedBy.length);
    }

    const roots = query.roots();
    for (const r of roots) expect(r.importedBy.length).toBe(0);
    for (const i of query.islands()) {
      expect(i.importedBy.length).toBe(0);
      expect(i.imports.length).toBe(0);
    }
  });

  it("computes affected-by-change depth", async () => {
    const shell = new ArcluxShell();
    await shell.handleCommand(repo);
    const query = new RepositoryQuery(shell["repository"]);
    const modules = query.modules();
    const target = modules.find((m) => m.importedBy.length > 0)!;
    const depth1 = query.affectedByChange(target.id, 1);
    const depth2 = query.affectedByChange(target.id, 2);
    expect(depth1.length).toBeGreaterThan(0);
    expect(new Set(depth2).size).toBe(depth2.length);
    expect(depth2.length).toBeGreaterThanOrEqual(depth1.length);
  });
});

describe("ShellSession", () => {
  it("opens a real workspace session with real environment values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-session-"));
    cpSync(repo, dir, { recursive: true });
    const session = new ShellSession();
    session.openWorkspace(dir);

    const snapshot = session.snapshot();
    expect(snapshot.environment.node).toBe(process.version);
    expect(snapshot.environment.pid).toBe(process.pid);
    expect(snapshot.environment.cwd).toBe(process.cwd());
    expect(snapshot.environment.home.length).toBeGreaterThan(0);
    expect(snapshot.environment.platform.length).toBeGreaterThan(0);

    expect(snapshot.workspace?.state.status).toBe("active");
    expect(snapshot.workspace?.state.repositoryRoot).toBe(dir);
    expect(snapshot.workspace?.processes).toEqual([]);

    expect(session.activeWorkspace?.getState().rootPath).toBe(dir);

    const workspace = session.activeWorkspace;
    session.close();
    expect(workspace?.status).toBe("closed");
    expect(session.activeWorkspace).toBeNull();
  });

  it("registers services and processes in the session kernel", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-session-"));
    cpSync(repo, dir, { recursive: true });
    const session = new ShellSession();
    session.openWorkspace(dir);
    session.registerService("bridge", "proc-1");
    expect(session.services()).toHaveLength(1);
    expect(session.services()[0].name).toBe("bridge");
    session.close();
  });
});

describe("loadPlugins", () => {
  it("loads plugins from a directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-plugins-"));
    writeFileSync(
      join(dir, "tool.ts"),
      `
        export default {
          name: "tool",
          run(ctx) { ctx.log("hello"); },
        };
      `
    );
    const plugins = await loadPlugins({ dir, fileNames: ["tool.ts"] });
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe("tool");
    expect(plugins[0].filePath).toBe(join(dir, "tool.ts"));
  });

  it("skips plugins without a valid default export", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arclux-plugins-"));
    writeFileSync(join(dir, "bad.ts"), `export const notAPlugin = 42;`);
    const plugins = await loadPlugins({ dir, fileNames: ["bad.ts"] });
    expect(plugins).toHaveLength(0);
  });

  it("returns empty when the plugin directory does not exist", async () => {
    const plugins = await loadPlugins({ dir: join(tmpdir(), "arclux-plugins-nope-" + Date.now()) });
    expect(plugins).toHaveLength(0);
  });
});