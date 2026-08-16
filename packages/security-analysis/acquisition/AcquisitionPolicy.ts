export interface AcquisitionPolicy { allowRemote: boolean; allowedHosts: string[]; maxBytes: number; timeoutMs: number; }
export const defaultAcquisitionPolicy: AcquisitionPolicy = { allowRemote: true, allowedHosts: [], maxBytes: 100 * 1024 * 1024, timeoutMs: 30_000 };
