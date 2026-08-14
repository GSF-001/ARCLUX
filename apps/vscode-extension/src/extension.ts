// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Verified 2026-08-14: pnpm install && pnpm build pass (tsc strict,
// @types/vscode ^1.85). Only manual test in VS Code's Extension
// Development Host (F5) remains.
//
// Minimal viable extension: connects to a running `arclux daemon
// --detach` for the open workspace, shows module count in the status
// bar, and surfaces diagnostics findings (packages/diagnostics/
// DiagnosticEngine.ts's output, forwarded by ArcluxDaemon over SSE) in
// VS Code's built-in Problems panel via a DiagnosticCollection --
// reuses VS Code's own UI for this instead of building a custom panel.

import * as vscode from "vscode";
import { findDaemonEndpoint, subscribeDaemonEvents } from "./daemonClient";

let statusBarItem: vscode.StatusBarItem;
let diagnosticCollection: vscode.DiagnosticCollection;
let closeSse: (() => void) | null = null;

function connect(workspaceRoot: string): void {
  const endpoint = findDaemonEndpoint(workspaceRoot);

  if (!endpoint) {
    statusBarItem.text = "$(circle-slash) ARCLUX: not running";
    statusBarItem.tooltip = "Run `arclux daemon --detach` in this repository's terminal";
    return;
  }

  statusBarItem.text = "$(sync~spin) ARCLUX: connecting...";

  closeSse = subscribeDaemonEvents(endpoint, {
    onAnalysis: (data: any) => {
      statusBarItem.text = `$(check) ARCLUX: ${data.moduleCount} modules`;
    },
    onDiagnostics: (data: any) => {
      diagnosticCollection.clear();
      const byFile = new Map<string, vscode.Diagnostic[]>();

      for (const finding of data.findings ?? []) {
        for (const loc of finding.locations ?? []) {
          const list = byFile.get(loc.filePath) ?? [];
          const line = Math.max(0, (loc.line ?? 1) - 1);
          const range = new vscode.Range(line, 0, line, 0);
          const severity =
            finding.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
          list.push(new vscode.Diagnostic(range, finding.message, severity));
          byFile.set(loc.filePath, list);
        }
      }

      for (const [filePath, diagnostics] of byFile) {
        const uri = vscode.Uri.file(`${workspaceRoot}/${filePath}`);
        diagnosticCollection.set(uri, diagnostics);
      }
    },
    onError: () => {
      statusBarItem.text = "$(warning) ARCLUX: connection lost";
    },
  });
}

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  diagnosticCollection = vscode.languages.createDiagnosticCollection("arclux");
  context.subscriptions.push(diagnosticCollection);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    connect(workspaceRoot);
  } else {
    statusBarItem.text = "$(circle-slash) ARCLUX: no workspace open";
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("arclux.connectDaemon", () => {
      if (workspaceRoot) connect(workspaceRoot);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arclux.showAnalysis", () => {
      vscode.window.showInformationMessage(statusBarItem.text);
    })
  );
}

export function deactivate(): void {
  closeSse?.();
  diagnosticCollection?.dispose();
}
