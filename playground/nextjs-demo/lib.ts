export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-");
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function unusedDateHelper(): void {
  // Never imported anywhere — should be flagged by detectUnusedExports.
}
