export interface SecurityTimeline { target: string; events: Array<{ at: string; label: string }>; }
export function createSecurityTimeline(target: string): SecurityTimeline { return { target, events: [{ at: new Date().toISOString(), label: "security-analysis" }] }; }
