export interface ObservationRecord { id: string; observedAt: string; value: unknown; }
export function createObservationRecord(value: unknown): ObservationRecord { return { id: crypto.randomUUID(), observedAt: new Date().toISOString(), value }; }
