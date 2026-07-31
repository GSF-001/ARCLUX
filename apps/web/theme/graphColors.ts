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
