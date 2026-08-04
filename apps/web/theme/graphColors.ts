// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { GraphNodeType, GraphEdgeType } from "@/packages/shared/types";

export const graphNodeColors: Record<GraphNodeType, { light: string; dark: string }> = {
  file: { light: "#3B7DD8", dark: "#52A8FF" },
  folder: { light: "#8A8A8A", dark: "#878787" },
  "external-package": { light: "#B0851F", dark: "#E5C07B" },
  route: { light: "#8E4EC6", dark: "#9D7CD8" },
  component: { light: "#12A594", dark: "#56B6C2" },
  hook: { light: "#D1383D", dark: "#E06C75" },
};

export const graphEdgeColors: Record<GraphEdgeType, { light: string; dark: string }> = {
  import: { light: "#B4B4B4", dark: "#454545" },
  export: { light: "#8E4EC6", dark: "#9D7CD8" },
  call: { light: "#3B7DD8", dark: "#52A8FF" },
  "route-link": { light: "#12A594", dark: "#56B6C2" },
};

export function getGraphNodeColor(type: GraphNodeType, mode: "light" | "dark" = "dark"): string {
  return graphNodeColors[type][mode];
}

export function getGraphEdgeColor(type: GraphEdgeType, mode: "light" | "dark" = "dark"): string {
  return graphEdgeColors[type][mode];
}

/**
 * Brighter, hand-picked colors for HIGHLIGHTED edges only. graphEdgeColors
 * dark["import"] (#454545) is deliberately dim so a busy graph doesn't look
 * noisy at rest, but that same dimness makes it nearly invisible against
 * GraphCanvas's black background once selected/hovered. These are NOT a
 * theme mode (no light/dark split) — GraphCanvas is hardcoded to a black
 * background regardless of app theme, so "highlighted" only ever needs
 * one bright variant per edge type.
 */
const graphEdgeHighlightColors: Record<GraphEdgeType, string> = {
  import: "#E5E5E5",
  export: "#C9A6F5",
  call: "#8FC4FF",
  "route-link": "#8FE8D8",
};

export function getGraphEdgeHighlightColor(type: GraphEdgeType): string {
  return graphEdgeHighlightColors[type];
}
