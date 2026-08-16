import { createSourceSnapshot } from "../acquisition/SourceSnapshot"; import type { SourceAdapter } from "./SourceAdapter";
export interface LocalSourceAdapter extends SourceAdapter { kind: "local"; }
export function createLocalSourceAdapter(): LocalSourceAdapter { return { kind: "local", async resolve(source) { return createSourceSnapshot(source, []); } }; }
