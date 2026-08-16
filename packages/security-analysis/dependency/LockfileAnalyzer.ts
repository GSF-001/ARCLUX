export interface LockfileAnalyzer { isPresent(files: string[]): boolean; }
export function createLockfileAnalyzer(): LockfileAnalyzer { return { isPresent: (files) => files.some((file) => /(^|\/)(pnpm-lock|package-lock|yarn\.lock|Gemfile\.lock|poetry\.lock)/.test(file)) }; }
