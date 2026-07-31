// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

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
