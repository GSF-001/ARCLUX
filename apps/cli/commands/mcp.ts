// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

import type { Command } from "commander";

export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Start MCP server — exposes ARCLUX tools via Model Context Protocol (stdio)")
    .action(async () => {
      const { startMcpServer } = await import("../../../packages/mcp/src/index.ts");
      await startMcpServer();
    });
}
