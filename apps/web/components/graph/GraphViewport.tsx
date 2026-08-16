// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { useState } from "react";

import { GraphProvider, useGraphContext } from "./GraphProvider";
import { GraphCanvas } from "./GraphCanvas";
import { GraphCanvas3D } from "./GraphCanvas3D";
import { GraphMenu } from "./GraphMenu";
import { GraphSearch } from "./GraphSearch";
import { GraphFocusView } from "./GraphFocusView";
import { GraphContextMenu } from "./GraphContextMenu";
import { Explorer } from "@/components/explorer/Explorer";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface GraphViewportProps {
  repoUrl: string;
  branch?: string;
}

/**
 * Right-hand module explorer, mounted when a FILE node is selected. Lives
 * in the flex layout OUTSIDE the canvas column (sibling, not overlay), so
 * GraphFocusView's inset-4 overlay never collides with it — the canvas
 * column just narrows. Folders / external packages have no file source to
 * inspect (FileDetails hits /api/file), so only "file"-type nodes open it.
 *
 * Closing the Explorer deselects the node (selectNode(null)), which also
 * closes the focus view — consistent with "close = stop inspecting this
 * module". Closing the focus view alone (its own X) keeps the Explorer
 * open: the node stays selected, so the deep inspection persists.
 */
function ExplorerPanel({ repoUrl, branch }: { repoUrl: string; branch?: string }) {
  const { graph, selectedNodeId, selectNode } = useGraphContext();
  // md+ keeps the Explorer as a 380px flex sibling (canvas column narrows);
  // below md a 380px sibling would leave the canvas ~0px wide on a phone,
  // so it becomes a full-screen overlay instead. Safe to branch on the
  // hook here: the panel only mounts after a client-side node selection.
  const isMdUp = useMediaQuery("(min-width: 48rem)");

  if (!selectedNodeId) return null;
  const selected = graph?.nodes.find((n) => n.id === selectedNodeId);
  if (!selected || selected.type !== "file") return null;

  return (
    <div
      className={
        isMdUp
          ? "h-full w-[380px] shrink-0"
          : "fixed inset-0 z-50 shadow-2xl"
      }
    >
      <Explorer
        repoUrl={repoUrl}
        moduleId={selectedNodeId}
        branch={branch}
        onClose={() => selectNode(null)}
      />
    </div>
  );
}

export function GraphViewport({ repoUrl, branch }: GraphViewportProps) {
  const [is3D, setIs3D] = useState(false);
  return (
    <GraphProvider repoUrl={repoUrl} branch={branch}>
      <div className="flex h-full w-full">
        <div className="relative h-full min-w-0 flex-1">
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <button
          onClick={() => setIs3D((v) => !v)}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 10,
            padding: "6px 12px", borderRadius: 8,
            background: "rgba(10,10,10,0.8)", color: "#ededed",
            border: "1px solid #2e2e2e", cursor: "pointer",
          }}
        >
          {is3D ? "2D View" : "3D View"}
        </button>
        {is3D ? <GraphCanvas3D /> : <GraphCanvas />}
      </div>
          <GraphMenu />
          <GraphSearch />
          <GraphFocusView />
          <GraphContextMenu />
        </div>
        <ExplorerPanel repoUrl={repoUrl} branch={branch} />
      </div>
    </GraphProvider>
  )
}
