import { helperB } from "./cyclicB";

export function helperA(): string {
  return helperB();
}
