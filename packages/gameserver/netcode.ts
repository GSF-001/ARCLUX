// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// netcode.ts — backward-compat re-export (transport logic now in transport/*).
// Prefer: import { createHttpClientTransport } from "./transport/HttpTransport"

export * from "./transport/Transport";
export * from "./transport/InProcessTransport";
export * from "./transport/HttpTransport";
