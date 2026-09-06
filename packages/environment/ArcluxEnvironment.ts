// Copyright 2026 GSF-001
//
// Licensed under the Apache License, Version 2.0 — See LICENSE-ENGINE in the repo root.
// SPDX-License-Identifier: Apache-2.0
//

// environment/ArcluxEnvironment.ts — interactive ARCLUX repository shell (readline REPL, execSync per command).

import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import process from "node:process";

function prompt() {
  return `arclux:${process.cwd()}$ `;
}

console.log(`
╭──────────────────────────────────────╮
│              A R C L U X             │
│       Repository Environment         │
╰──────────────────────────────────────╯
`);

console.log(`Workspace: ${process.cwd()}`);
console.log("");

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: prompt(),
});

rl.prompt();

rl.on("line", (input) => {
  const command = input.trim();

  if (!command) {
    rl.prompt();
    return;
  }

  if (command === "exit") {
    rl.close();
    return;
  }

  try {
    execSync(command, {
      stdio: "inherit",
      cwd: process.cwd(),
      shell: "/bin/bash",
    });
  } catch {
    // Command failed; keep the environment alive.
  }

  rl.setPrompt(prompt());
  rl.prompt();
});

rl.on("close", () => {
  console.log("\nLeaving ARCLUX environment.");
  process.exit(0);
});
