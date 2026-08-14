// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { NextResponse } from "next/server";

/**
 * GET /api/notifications — placeholder endpoint (KI-029 family: scaffold
 * files with no exports broke `next build`'s generated route types).
 * Returns an explicitly-empty list; real implementation belongs on top of
 * packages/notifications (NotificationManager fan-out). Empty array =
 * "nothing reported yet", not "checked and clean".
 */
export async function GET() {
  return NextResponse.json({ notifications: [] }, { status: 200 });
}
