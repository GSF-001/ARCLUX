export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  return items.slice((page - 1) * perPage, page * perPage);
}

export function unusedValidator(): boolean {
  // Never imported anywhere — should be flagged by detectUnusedExports.
  return true;
}
