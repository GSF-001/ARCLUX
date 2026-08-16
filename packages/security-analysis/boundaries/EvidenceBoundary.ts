export interface EvidenceBoundary { maxSourceLength: number; redactSecrets: boolean; }
export const defaultEvidenceBoundary: EvidenceBoundary = { maxSourceLength: 500, redactSecrets: true };
