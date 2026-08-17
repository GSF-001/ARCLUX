export interface SourceBoundaryPolicy { excludedPaths: string[]; maxFileBytes: number; }
export const defaultSourceBoundaryPolicy: SourceBoundaryPolicy = { excludedPaths: ["node_modules", ".git", "dist", "build"], maxFileBytes: 5 * 1024 * 1024 };
