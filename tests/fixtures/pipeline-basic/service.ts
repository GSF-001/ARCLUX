// Fixture for tests/pipeline.test.ts — deterministic import chain:
// entry.ts -> service.ts -> repository.ts
import { getRepository } from "./repository";

export function getService(): string {
  return getRepository();
}
