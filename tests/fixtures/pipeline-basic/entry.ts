// Fixture for tests/pipeline.test.ts — deterministic import chain:
// entry.ts -> service.ts -> repository.ts
import { getService } from "./service";

export function main(): string {
  return getService();
}
