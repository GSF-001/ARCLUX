// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SecurityFinding } from "../SecurityFinding"; export interface SecurityImpactAnalyzer { analyze(findings: SecurityFinding[]): number; }
export function createSecurityImpactAnalyzer(): SecurityImpactAnalyzer { return { analyze: (findings) => findings.reduce((score, f) => score + ({ info: 0, low: 1, medium: 3, high: 6, critical: 10 }[f.severity]), 0) }; }
