// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { LayerRecord } from "../contracts"; export interface EnvironmentConfigAnalyzer extends LayerRecord { variables: string[]; }
export function createEnvironmentConfigAnalyzer(variables: string[] = []): EnvironmentConfigAnalyzer { return { id: crypto.randomUUID(), variables: [...variables] }; }
