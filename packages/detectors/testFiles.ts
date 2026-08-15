// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Test-file classifier shared by detectors that should NOT flag test files
// as orphan/dead/unused: runners (vitest, pytest) invoke test files by
// naming convention — like entry points, not via an import statement — so
// "nothing imports this" is not a finding for them.
// Decision #459 (GSF-001/ARCLUX), Variant A: exclude by convention.

const TS_TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const PY_TEST_FILE = /(^|\/)(test_[^/]+\.py|[^/]+_test\.py|conftest\.py)$/;

export function isTestFilePath(relativePath: string): boolean {
  return TS_TEST_FILE.test(relativePath) || PY_TEST_FILE.test(relativePath);
}
