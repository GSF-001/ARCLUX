// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-3d";

import { GraphProvider, useGraphContext } from "./GraphProvider";
import { GraphCanvas } from "./GraphCanvas";
import { GraphCanvas3D } from "./GraphCanvas3D";
import { GraphMenu } from "./GraphMenu";
import { GraphSearch } from "./GraphSearch";
import { GraphFocusView } from "./GraphFocusView";
import { GraphContextMenu } from "./GraphContextMenu";
import { GraphAuditOverlay } from "./GraphAuditOverlay";
import { Explorer } from "@/components/explorer/Explorer";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface GraphViewportProps {
  repoUrl: string;
  branch?: string;
}

/**
 * Right-hand code drawer ("CodeDrawer"), opened when a FILE node is
 * selected — a 480px sheet (md:w-120) with File/Dependencies/Impact tabs.
 * Always mounted so the slide-in/out transition can run in both
 * directions; the Explorer content only renders while open. Positioned as
 * a fixed overlay (z-60) over the canvas on ALL viewports — desktop is a
 * 480px right-side sheet, mobile is full-width with a click-to-close
 * backdrop (z-59).
 *
 * The central focus panel (GraphFocusView) opens ALONGSIDE this drawer for
 * file nodes: on md+ screens it shifts left of the drawer's 480px width
 * (right-[31rem]), so the two surfaces never overlap — the old clipping
 * bug is fixed by layout, not by hiding one of them (see GraphFocusView.tsx
 * for the positioning logic). Folders / external packages have no file
 * source to inspect (FileDetails hits /api/file), so only "file"-type
 * nodes open the drawer; they still get the full-width central panel.
 *
 * Closing the drawer deselects the node (selectNode(null)), which also
 * closes the focus panel — consistent with "close = stop inspecting this
 * module". Closing the focus panel alone (its own X) keeps the drawer
 * open: the node stays selected, so the deep inspection persists.
 */
function ExplorerPanel({ repoUrl, branch }: { repoUrl: string; branch?: string }) {
  const { graph, selectedNodeId, selectNode } = useGraphContext();
  const isMdUp = useMediaQuery("(min-width: 48rem)");

  const selectedNode = selectedNodeId ? graph?.nodes.find((n) => n.id === selectedNodeId) : null;
  const isOpen = selectedNode?.type === "file";

  return (
    <>
      {!isMdUp && isOpen && (
        <div
          className="fixed inset-0 z-59 bg-black/60"
          onClick={() => selectNode(null)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 right-0 bottom-0 z-60 w-full md:w-120 bg-[#0d1117] border-l border-[#30363d] shadow-2xl overflow-y-auto transition-transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        {isOpen && selectedNode && (
          <Explorer
            repoUrl={repoUrl}
            moduleId={selectedNode.id}
            branch={branch}
            onClose={() => selectNode(null)}
          />
        )}
      </div>
    </>
  );
}

export function GraphViewport({ repoUrl, branch }: GraphViewportProps) {
  const [is3D, setIs3D] = useState(false);
  // Shared handle to the live ForceGraph3D instance (undefined in 2D mode),
  // filled by GraphCanvas3D and read by GraphMenu so the view controls
  // drive the 3D camera instead of the 2D transform when in 3D mode.
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  return (
    <GraphProvider repoUrl={repoUrl} branch={branch}>
      <div className="flex h-full w-full">
        <div className="relative h-full min-w-0 flex-1">
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {is3D ? <GraphCanvas3D fgRef={fgRef} /> : <GraphCanvas />}
          </div>
          {is3D && <GraphAuditOverlay repoUrl={repoUrl} branch={branch} fgRef={fgRef} />}
          <GraphMenu is3D={is3D} onToggle3D={() => setIs3D((v) => !v)} fgRef={fgRef} />
          <GraphSearch />
          <GraphFocusView />
          <GraphContextMenu />
        </div>
        <ExplorerPanel repoUrl={repoUrl} branch={branch} />
      </div>
    </GraphProvider>
  )
}
