import type { SurfaceObservation } from "./SurfaceDiscovery";

export function discoverEndpoints(surface: SurfaceObservation): string[] {
  return [`${surface.target}${surface.endpoint}`];
}
