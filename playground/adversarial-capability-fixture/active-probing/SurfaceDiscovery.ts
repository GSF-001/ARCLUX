export interface SurfaceObservation { target: string; endpoint: string; }

export function discoverSurface(target: string): SurfaceObservation {
  return { target, endpoint: "/mock/surface" };
}
