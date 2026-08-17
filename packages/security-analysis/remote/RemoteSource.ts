export interface RemoteSource { url: string; provider: "github" | "gitlab" | "archive" | "unknown"; }
export function createRemoteSource(url: string): RemoteSource { return { url, provider: url.includes("github") ? "github" : url.includes("gitlab") ? "gitlab" : "unknown" }; }
