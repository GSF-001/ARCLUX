// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// VS Code extension for ARCLUX: connects to a running `arclux daemon
// --detach` for the open workspace, shows module count in the status bar,
// surfaces diagnostics findings in the Problems panel, and adds an
// impact command that answers "what breaks if I change this file" from
// inside the editor.
//
// Robustness (not a one-shot connect):
//   - auto-connect when the daemon starts after the editor (watches the
//     ~/.arclux/endpoints directory)
//   - auto-reconnect SSE with backoff when the connection drops
//   - 30s poll of GET /analysis so the status bar stays fresh even if SSE
//     is unavailable
//   - re-connect when the workspace folder changes
//   - commands: arclux.connect, arclux.refresh, arclux.impact, arclux.menu
//   - status bar click opens the command menu

import * as vscode from "vscode";
import * as path from "path";
import {
  findDaemonEndpoint,
  watchEndpointsDir,
  fetchAnalysis,
  fetchImpact,
  subscribeDaemonEvents,
  type DaemonEndpoint,
  type AnalysisSnapshot,
} from "./daemonClient";

let statusBarItem: vscode.StatusBarItem;
let diagnosticCollection: vscode.DiagnosticCollection;

let closeSse: (() => void) | null = null;
let closeEndpointWatcher: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

let workspaceRoot: string | null = null;
let endpoint: DaemonEndpoint | null = null;
let lastAnalysis: AnalysisSnapshot | null = null;

const POLL_INTERVAL_MS = 30_000;

function setStatus(text: string, tooltip?: string): void {
  statusBarItem.text = text;
  if (tooltip) statusBarItem.tooltip = tooltip;
}

function relPath(filePath: string): string | null {
  if (!workspaceRoot) return null;
  const rel = path.relative(workspaceRoot, filePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.replace(/\\/g, "/");
}

async function refreshAnalysis(): Promise<void> {
  if (!endpoint) return;
  try {
    lastAnalysis = await fetchAnalysis(endpoint);
    const { moduleCount, graph, meta } = lastAnalysis;
    const graphPart = graph ? `, ${graph.nodes} nodes / ${graph.edges} edges` : "";
    setStatus(
      `$(check) ARCLUX: ${moduleCount} modules${graphPart}`,
      meta.name ? `ARCLUX — ${meta.name} (${moduleCount} modules)` : undefined
    );
  } catch {
    // Transient — the next poll or SSE event will update the status.
  }
}

function connect(root: string): void {
  const found = findDaemonEndpoint(root);
  if (!found) {
    endpoint = null;
    setStatus("$(circle-slash) ARCLUX: not running", "Run `arclux daemon --detach` in this repository's terminal");
    return;
  }
  endpoint = found;
  setStatus("$(sync~spin) ARCLUX: connecting...");

  closeSse?.();
  closeSse = subscribeDaemonEvents(found, {
    onAnalysis: (data: any) => {
      lastAnalysis = data as AnalysisSnapshot;
      const moduleCount = (data as AnalysisSnapshot).moduleCount;
      setStatus(`$(check) ARCLUX: ${moduleCount} modules`);
      refreshAnalysis();
    },
    onDiagnostics: (data: any) => {
      updateDiagnostics(data);
    },
    onError: () => {
      setStatus("$(warning) ARCLUX: reconnecting…");
    },
  });

  refreshAnalysis();
}

function updateDiagnostics(data: any): void {
  diagnosticCollection.clear();
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const finding of data.findings ?? []) {
    for (const loc of finding.locations ?? []) {
      const list = byFile.get(loc.filePath) ?? [];
      const line = Math.max(0, (loc.line ?? 1) - 1);
      const range = new vscode.Range(line, 0, line, 0);
      const severity =
        finding.severity === "error"
          ? vscode.DiagnosticSeverity.Error
          : finding.severity === "warning"
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;
      list.push(new vscode.Diagnostic(range, finding.message, severity));
      byFile.set(loc.filePath, list);
    }
  }

  for (const [filePath, diagnostics] of byFile) {
    const uri = vscode.Uri.file(path.join(workspaceRoot ?? "", filePath));
    diagnosticCollection.set(uri, diagnostics);
  }
}

async function commandImpact(): Promise<void> {
  if (!endpoint) {
    vscode.window.showErrorMessage("ARCLUX daemon is not running. Run `arclux daemon --detach` first.");
    return;
  }
  if (!workspaceRoot) {
    vscode.window.showErrorMessage("No workspace is open.");
    return;
  }

  const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
  const relative = activeFile ? relPath(activeFile) : null;

  const pick = await vscode.window.showQuickPick(
    [
      {
        label: "$(file-code) Current file",
        description: relative ?? "(no active editor — type a path instead)",
        detail: "Impact of the file you're currently editing",
        value: relative ?? undefined,
      },
      {
        label: "$(type-hierarchy) Type a relative path…",
        description: "e.g. src/components/Button.tsx",
        value: undefined,
      },
    ],
    { placeHolder: "Which file do you want to trace?" }
  );
  if (!pick) return;

  let file = pick.value;
  if (!file) {
    const input = await vscode.window.showInputBox({
      prompt: "Relative file path",
      value: relative ?? "",
      placeHolder: "src/components/Button.tsx",
    });
    if (!input) return;
    file = input;
  }

  setStatus("$(sync~spin) ARCLUX: tracing impact…");
  try {
    const result = await fetchImpact(endpoint, file);
    if (!result.ok) {
      setStatus("$(warning) ARCLUX: impact failed");
      const suggestions = result.suggestions?.length
        ? `\nDid you mean:\n${result.suggestions.map((s) => `  ${s}`).join("\n")}`
        : "";
      vscode.window.showErrorMessage(`ARCLUX: ${result.error ?? "module not found"}${suggestions}`);
      return;
    }

    const consumers = (result.consumers ?? []).map((c) => ({
      label: `$(references) ${c}`,
      description: "consumer",
      detail: `distance 1 — imports ${result.file}`,
      filePath: c,
    }));
    const affected = (result.affected ?? []).map((a) => ({
      label: `$(diff) ${a.filePath}`,
      description: a.distance === 2 ? "transitively affected" : `distance ${a.distance}`,
      detail: `chain of ${a.distance} imports away`,
      filePath: a.filePath,
    }));

    const selected = await vscode.window.showQuickPick([...consumers, ...affected], {
      placeHolder: `${result.file}: ${result.directConsumers} direct consumers, ${result.totalAffected} files affected in total`,
      matchOnDescription: true,
    });

    if (selected?.filePath) {
      const full = path.join(workspaceRoot, selected.filePath);
      const doc = await vscode.workspace.openTextDocument(full);
      await vscode.window.showTextDocument(doc, { preview: true });
    }

    setStatus(
      `$(check) ARCLUX: ${result.file} → ${result.totalAffected} affected`,
      `${result.directConsumers} direct consumers, ${result.totalAffected} files affected in total`
    );
  } catch (err) {
    setStatus("$(warning) ARCLUX: impact failed");
    vscode.window.showErrorMessage(`ARCLUX: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function commandMenu(): Promise<void> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "$(refresh) Refresh status", description: "Re-read GET /analysis now", id: "refresh" },
      { label: "$(type-hierarchy) Impact (current file)…", description: "What breaks if I change this file", id: "impact" },
      { label: "$(plug) Reconnect", description: "Force a reconnect to the daemon", id: "reconnect" },
      {
        label: "$(open-preview) Open analysis report",
        description: lastAnalysis ? `${lastAnalysis.moduleCount} modules` : "no analysis yet",
        id: "report",
      },
    ],
    { placeHolder: "ARCLUX — choose an action" }
  );
  if (!choice) return;

  if (choice.id === "refresh") await refreshAnalysis();
  if (choice.id === "impact") await commandImpact();
  if (choice.id === "reconnect" && workspaceRoot) connect(workspaceRoot);
  if (choice.id === "report") {
    const text = lastAnalysis
      ? `ARCLUX ${lastAnalysis.meta.name ?? ""}: ${lastAnalysis.moduleCount} modules` +
        (lastAnalysis.graph ? `, ${lastAnalysis.graph.nodes} nodes / ${lastAnalysis.graph.edges} edges` : "") +
        (lastAnalysis.scan ? `, ${lastAnalysis.scan.filesParsed} files parsed` : "")
      : "ARCLUX: no analysis yet — start the daemon and run refresh.";
    vscode.window.showInformationMessage(text);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "arclux.menu";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  diagnosticCollection = vscode.languages.createDiagnosticCollection("arclux");
  context.subscriptions.push(diagnosticCollection);

  workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;

  const setup = () => {
    if (!workspaceRoot) {
      setStatus("$(circle-slash) ARCLUX: no workspace open");
      return;
    }
    connect(workspaceRoot);

    // Auto-connect: when a daemon endpoint appears/disappears later
    // (daemon started after the editor, or stopped), react immediately
    // instead of waiting for the next poll.
    closeEndpointWatcher?.();
    closeEndpointWatcher = watchEndpointsDir((endpoints) => {
      const found = findDaemonEndpoint(workspaceRoot!);
      if (found && !endpoint) {
        connect(workspaceRoot!);
      } else if (!found && endpoint) {
        endpoint = null;
        closeSse?.();
        setStatus("$(circle-slash) ARCLUX: not running", "Run `arclux daemon --detach` in this repository's terminal");
      }
    });

    // Keep the status bar fresh even if SSE never reconnects.
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => refreshAnalysis(), POLL_INTERVAL_MS);
  };

  setup();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
      setup();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arclux.connect", () => {
      if (workspaceRoot) connect(workspaceRoot);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arclux.refresh", () => refreshAnalysis())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arclux.impact", () => commandImpact())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("arclux.menu", () => commandMenu())
  );
}

export function deactivate(): void {
  closeSse?.();
  closeEndpointWatcher?.();
  if (pollTimer) clearInterval(pollTimer);
  diagnosticCollection?.dispose();
}