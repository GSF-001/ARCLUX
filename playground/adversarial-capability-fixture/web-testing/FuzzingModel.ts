import type { InputVariant } from "./InputMutation";

export function modelFuzzing(): { inputMutation: true; variants: InputVariant[] } {
  return { inputMutation: true, variants: [{ name: "baseline", value: "safe" }, { name: "mutated", value: "safe-variant" }] };
}
