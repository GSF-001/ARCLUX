"use client";

import { useState, useEffect } from "react";
import { FileDetails, type DiagnosticMarker } from "./FileDetails";
import { DependencyList } from "./DependencyList";
import { ImpactSummary } from "./ImpactSummary";

type ExplorerTab = "file" | "dependencies" | "impact";

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
  const [activeTab, setActiveTab] = useState<ExplorerTab>("file");
  const [fileDiagnostics, setFileDiagnostics] = useState<DiagnosticMarker[]>([]);

  // Fetches once per repoUrl/branch (not per file switch) -- POST /api/diagnostics
  // does a full clone+index per call (same cost as /api/analyze, /api/doctor),
  // so re-fetching on every file open inside the same repo would be wasteful.
  // Findings are filtered by moduleId client-side per render instead.
  const [allDiagnostics, setAllDiagnostics] = useState<any[]>([]);
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

  useEffect(() => {
    const filtered: DiagnosticMarker[] = allDiagnostics
      .filter((e: any) => e.filePath === moduleId)
      .map((e: any) => ({
        line: e.line,
        severity: e.severity,
        message: e.message,
        checkId: e.checkId,
      }));
    setFileDiagnostics(filtered);
  }, [allDiagnostics, moduleId]);

  return (
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
  );
}
