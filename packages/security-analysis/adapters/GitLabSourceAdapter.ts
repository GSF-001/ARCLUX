import { createLocalSourceAdapter } from "./LocalSourceAdapter"; import type { SourceAdapter } from "./SourceAdapter";
export interface GitLabSourceAdapter extends SourceAdapter { kind: "gitlab"; }
export function createGitLabSourceAdapter(): GitLabSourceAdapter { return { ...createLocalSourceAdapter(), kind: "gitlab" }; }
