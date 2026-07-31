import type { Repository } from "../repository/Repository";

export interface RuleViolation {
  ruleId: string;
  message: string;
  filePath: string;
  severity: "error" | "warning";
}

export interface Rule {
  id: string;
  description: string;
  appliesToFramework: string;
  check(repository: Repository): RuleViolation[];
}

export function runRules(repository: Repository, rules: Rule[], detectedFrameworks: string[]): RuleViolation[] {
  const applicable = rules.filter((rule) => detectedFrameworks.includes(rule.appliesToFramework));
  return applicable.flatMap((rule) => rule.check(repository));
}
