import { createLocalSourceAdapter } from "./LocalSourceAdapter"; import type { SourceAdapter } from "./SourceAdapter";
export interface ArchiveSourceAdapter extends SourceAdapter { kind: "archive"; }
export function createArchiveSourceAdapter(): ArchiveSourceAdapter { return { ...createLocalSourceAdapter(), kind: "archive" }; }
