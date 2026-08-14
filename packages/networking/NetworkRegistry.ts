// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Generalizes packages/networking/ServiceEndpoint.ts's single-endpoint
// discovery-file pattern (one file per daemonId under ~/.arclux/endpoints/)
// into a listing API -- for a future consumer that needs "show me every
// ARCLUX daemon currently running on this machine", not just "find the one
// for this repo" (which ServiceEndpoint.findServiceEndpoint-equivalent already covers).

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { ServiceEndpoint } from "./ServiceEndpoint";

function endpointsDir(): string {
  return path.join(process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux"), "endpoints");
}

export interface RegisteredEndpoint {
  daemonId: string;
  endpoint: ServiceEndpoint;
}

/** Lists every currently-registered daemon endpoint on this machine (does not verify they're still alive -- see ConnectionManager for that). */
export function listRegisteredEndpoints(): RegisteredEndpoint[] {
  let files: string[];
  try {
    files = fs.readdirSync(endpointsDir());
  } catch {
    return [];
  }

  const results: RegisteredEndpoint[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = fs.readFileSync(path.join(endpointsDir(), file), "utf8");
      results.push({ daemonId: file.replace(/\.json$/, ""), endpoint: JSON.parse(raw) });
    } catch {
      continue;
    }
  }
  return results;
}
