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