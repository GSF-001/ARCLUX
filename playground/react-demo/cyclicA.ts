// Deliberately circular with cyclicB — should be flagged by detectCircularDependency.
import { helperB } from "./cyclicB";

export function helperA(): string {
  return helperB();
}
