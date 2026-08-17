import { createLocalSourceAdapter } from "./LocalSourceAdapter"; import type { SourceAdapter } from "./SourceAdapter";
export interface GitHubSourceAdapter extends SourceAdapter { kind: "github"; }
export function createGitHubSourceAdapter(): GitHubSourceAdapter { return { ...createLocalSourceAdapter(), kind: "github" }; }
