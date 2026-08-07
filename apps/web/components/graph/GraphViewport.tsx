// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { GraphProvider } from "./GraphProvider";
import { GraphCanvas } from "./GraphCanvas";
import { GraphMenu } from "./GraphMenu";
import { GraphSearch } from "./GraphSearch";
import { GraphFocusView } from "./GraphFocusView";
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
        <GraphMenu />
        <GraphSearch />
        <GraphFocusView />
        <GraphContextMenu />
      </div>
    </GraphProvider>
  )
}
