// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextResponse } from "next/server";

/**
 * GET /api/diagnostics
 *
 * Placeholder endpoint (issue KI-029): the previous 8-line scaffold had no
 * exports, which made `next build`'s generated route type fail to compile
 * ("File ... is not a module"). This file now has a valid route export
 * returning an empty, explicitly-empty result — consumers must treat an
 * empty `diagnostics` array as "nothing reported yet", not "checked and
 * clean". The real implementation belongs on top of the detector pipeline
 * (see POST /api/doctor for the runDoctor-based approach); this route
 * intentionally does NOT fake a full scan.
 */
export async function GET() {
  return NextResponse.json({ diagnostics: [] }, { status: 200 });
}
