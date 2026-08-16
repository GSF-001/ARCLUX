export interface RequestAssessment { networkIo: "modeled"; dynamicTarget: true; }

export function assessRequest(target: string): RequestAssessment & { target: string } {
  return { networkIo: "modeled", dynamicTarget: true, target };
}
