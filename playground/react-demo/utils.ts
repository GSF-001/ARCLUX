export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function unusedFormatter(): void {
  // Never imported anywhere — should be flagged by detectUnusedExports.
}
