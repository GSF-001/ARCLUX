export interface InputVariant { name: "baseline" | "mutated"; value: string; }

export function createInputVariants(): InputVariant[] {
  return [{ name: "baseline", value: "safe" }, { name: "mutated", value: "safe-variant" }];
}
