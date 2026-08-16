export interface NetworkAssessment { networkIo: "mock-only"; target: string; }

export function assessNetwork(target: string): NetworkAssessment {
  return { networkIo: "mock-only", target };
}
