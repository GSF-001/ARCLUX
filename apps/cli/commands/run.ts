/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * `arclux run <name>` — start a named internal service via RuntimeManager.
 * Currently supports "web" (apps/web dev server). Add more named specs
 * here as other internal services (watcher, indexer) get wired in.
 */

import type { Command } from "commander";
import { RuntimeManager } from "../../../packages/runtime/RuntimeManager";
import type { ProcessSpec } from "../../../packages/runtime/ProcessSpec";

const KNOWN_SERVICES: Record<string, ProcessSpec> = {
  web: {
    id: "web",
    name: "ARCLUX Web",
    command: "npm",
    args: ["run", "dev"],
    cwd: "apps/web",
    autorestart: true,
  },
};

async function runCommand(args: string[]): Promise<void> {
  const [serviceName] = args;
  const spec = serviceName ? KNOWN_SERVICES[serviceName] : undefined;

  if (!spec) {
    console.error(
      `Unknown service "${serviceName ?? ""}". Known services: ${Object.keys(KNOWN_SERVICES).join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  const runtime = new RuntimeManager();
  runtime.kernel.signalBus.on("log:out", (payload: any) => {
    process.stdout.write(payload.data);
  });
  runtime.kernel.signalBus.on("log:err", (payload: any) => {
    process.stderr.write(payload.data);
  });

  runtime.startService(spec);
}

export function registerRunCommand(program: Command): void {
  program
    .command("run <service>")
    .description("Start a named internal service (web, ...)")
    .action(async (service: string) => {
      await runCommand([service]);
    });
}
