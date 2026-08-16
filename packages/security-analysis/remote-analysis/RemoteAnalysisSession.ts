export interface RemoteAnalysisSession { id: string; source: string; startedAt: string; status: "pending" | "running" | "completed" | "failed"; }
export function createRemoteAnalysisSession(source: string): RemoteAnalysisSession { return { id: crypto.randomUUID(), source, startedAt: new Date().toISOString(), status: "pending" }; }
