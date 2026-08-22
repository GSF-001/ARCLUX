"use client";

import { useState, useEffect, useMemo } from "react";
import { FileDetails, type DiagnosticMarker } from "./FileDetails";
import { DependencyList } from "./DependencyList";
import { ImpactSummary } from "./ImpactSummary";
import { GraphProvider } from "../graph/GraphProvider";

type ExplorerTab = "file" | "dependencies" | "impact";

interface RawDiagnosticEvent {
  filePath: string;
  line: number;
  severity: "error" | "warning";
  message: string;
  checkId: string;
}

const TABS: { id: ExplorerTab; label: string }[] = [
  { id: "file", label: "File" },
  { id: "dependencies", label: "Dependencies" },
  { id: "impact", label: "Impact" },
];

export interface ExplorerProps {
  repoUrl: string;
  /**
   * ModuleInfo.id -- confirmed identical to relativePath per
   * buildIndex.ts pass 3 (`modulesByPath.set(relativePath, { id:
   * relativePath, ... })`), jadi dipake langsung sebagai `filePath` ke
   * FileDetails dan sebagai `moduleId` ke DependencyList/ImpactSummary
   * tanpa transformasi.
   */
  moduleId: string;
  branch?: string;
  onClose?: () => void;
}

/**
 * STATUS: desain baru, BELUM ada consumer (grep app/+components kosong
 * saat file ini ditulis) -- shape props di atas adalah keputusan
 * sekarang, bukan kontrak yang udah disepakati sebelumnya. Cek ulang
 * kalau nanti mau dipasang ke SplitPane.tsx / halaman graph.
 *
 * Tidak dipakein primitives/Tabs.tsx -- statusnya belum dikonfirmasi
 * selesai di PROGRES-status.md (cuma Avatar/Badge/Checkbox/Kbd/Skeleton/
 * Switch/Separator yang eksplisit disebut selesai). Pake tab switcher
 * manual di sini biar gak nge-couple ke komponen yang belum pasti jalan.
 */
export function Explorer({ repoUrl, moduleId, branch, onClose }: ExplorerProps) {
  // Dependencies is the default tab when a node is clicked: it shows the
  // incoming/outgoing imports for the module INSTANTLY (read from the
  // graph GraphProvider already loaded — no API call). Impact was tried
  // as the default first, but /api/impact re-clones + re-indexes the
  // whole repo per request, so the drawer sat on a spinner instead of
  // showing content (live feedback from dogfooding, 2026-08-16). File
  // stays one click away for users who want the source.
  const [activeTab, setActiveTab] = useState<ExplorerTab>("dependencies");
  // Reset to the default tab whenever the inspected node changes, so a
  // fresh node click always lands on Dependencies even if the user had
  // switched to File/Impact for the previous node. React-recommended
  // render-time state adjustment keyed on the previous prop (same pattern
  // as GraphFocusView's collapse-on-node-change).
  const [prevModuleId, setPrevModuleId] = useState(moduleId);
  if (prevModuleId !== moduleId) {
    setPrevModuleId(moduleId);
    setActiveTab("dependencies");
  }
  // Fetches once per repoUrl/branch (not per file switch) -- POST /api/diagnostics
  // does a full clone+index per call (same cost as /api/analyze, /api/doctor),
  // so re-fetching on every file open inside the same repo would be wasteful.
  // Filtered to the currently open file via useMemo below, instead of a
  // second useEffect calling setState (which triggers a cascading render).
  const [allDiagnostics, setAllDiagnostics] = useState<RawDiagnosticEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl, branch }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setAllDiagnostics(json.events ?? []);
      })
      .catch(() => {
        // best-effort -- FileDetails still works without diagnostics, just no gutter markers
      });
    return () => {
      cancelled = true;
    };
  }, [repoUrl, branch]);

  const fileDiagnostics = useMemo<DiagnosticMarker[]>(
    () =>
      allDiagnostics
        .filter((e) => e.filePath === moduleId)
        .map((e) => ({ line: e.line, severity: e.severity, message: e.message, checkId: e.checkId })),
    [allDiagnostics, moduleId]
  );

  return (
    <GraphProvider repoUrl={repoUrl} branch={branch}>
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between bg-muted/20 px-4 py-2">
        <p className="truncate font-mono text-xs text-muted-foreground">{moduleId}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex bg-muted/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm ${
              activeTab === tab.id
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "file" && <FileDetails repoUrl={repoUrl} filePath={moduleId} branch={branch} diagnostics={fileDiagnostics} />}
        {activeTab === "dependencies" && (
          <DependencyList repoUrl={repoUrl} moduleId={moduleId} branch={branch} />
        )}
        {activeTab === "impact" && (
          <ImpactSummary repoUrl={repoUrl} moduleId={moduleId} branch={branch} />
        )}
      </div>
    </div>
    </GraphProvider>
  );
}
