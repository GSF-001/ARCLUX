"use client";

import { GraphProvider } from "./GraphProvider";
import { GraphCanvas } from "./GraphCanvas";
import { GraphToolbar } from "./GraphToolbar";
import { GraphLegend } from "./GraphLegend";
import { GraphSearch } from "./GraphSearch";
import { GraphSelection } from "./GraphSelection";
import { GraphContextMenu } from "./GraphContextMenu";

export interface GraphViewportProps {
  repoUrl: string;
  branch?: string;
}

export function GraphViewport({ repoUrl, branch }: GraphViewportProps) {
  return (
    <GraphProvider repoUrl={repoUrl} branch={branch}>
      <div className="relative h-full w-full">
        <GraphCanvas />
        <GraphToolbar />
        <GraphSearch />
        <GraphSelection />
        <GraphLegend />
        <GraphContextMenu />
      </div>
    </GraphProvider>
  )
}
