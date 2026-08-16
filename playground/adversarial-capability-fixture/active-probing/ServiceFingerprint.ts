export interface ServiceFingerprint { target: string; protocol: "mock"; }

export function fingerprintService(target: string): ServiceFingerprint {
  return { target, protocol: "mock" };
}
