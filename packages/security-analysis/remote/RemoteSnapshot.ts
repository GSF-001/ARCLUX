import type { SourceSnapshot } from "../acquisition/SourceSnapshot"; export type RemoteSnapshot = SourceSnapshot & { remote: true };
export function createRemoteSnapshot(snapshot: SourceSnapshot): RemoteSnapshot { return { ...snapshot, remote: true }; }
