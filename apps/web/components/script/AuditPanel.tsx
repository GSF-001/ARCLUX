// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { AuditWorkspace } from "@/components/script/AuditWorkspace"

/**
 * Thin shell so the script playground terminal hosts the full audit
 * experience. All logic lives in AuditWorkspace — the standalone
 * /[org]/[repo]/audit page renders the same component with repo context
 * from the URL.
 */
export function AuditPanel() {
  return <AuditWorkspace />
}