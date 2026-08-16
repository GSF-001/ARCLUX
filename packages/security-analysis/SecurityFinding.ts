// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SecurityCategory } from "./SecurityCategory";
import type { SecuritySeverity } from "./SecuritySeverity";
import type { SecurityEvidence } from "./SecurityEvidence";

export interface SecurityFinding {
  id: string;
  title: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  message: string;
  evidence: SecurityEvidence[];
  confidence: number;
  remediation?: string;
}
