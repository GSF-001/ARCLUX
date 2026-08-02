export function hashPassword(raw: string): string {
  return `hashed:${raw}`;
}

export function unusedTokenHelper(): void {
  // Never imported anywhere — should be flagged by detectUnusedExports.
}
