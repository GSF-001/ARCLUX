// Fixture for tests/pipeline.test.ts — deterministic import chain:
// entry.ts -> service.ts -> repository.ts (sink node, imports nothing)
export function getRepository(): string {
  return "data";
}
