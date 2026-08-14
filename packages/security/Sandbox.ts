// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Enforces PermissionManager checks at the point a process is about to
// actually spawn/act, instead of relying on callers to remember to check.
// This is the integration point ProcessManager.start() should call
// through, mirroring how packages/diagnostics wraps detectors instead of
// callers running detectors ad hoc.

import type { ProcessSpec } from "../runtime/ProcessSpec";
import { PermissionManager } from "./PermissionManager";
import { Capability, type CapabilityValue } from "./Capability";

export interface SandboxCheckResult {
  allowed: boolean;
  denied: string[];
}

export class Sandbox {
  constructor(private readonly permissions: PermissionManager) {}

  /**
   * Checks whether a ProcessSpec is allowed to run, based on what it
   * actually needs: EXEC always, ENV_WRITE if spec.env is set (it's
   * injecting/overriding env vars for the child).
   */
  checkSpec(spec: ProcessSpec): SandboxCheckResult {
    const required: CapabilityValue[] = [Capability.EXEC];
    if (spec.env && Object.keys(spec.env).length > 0) {
      required.push(Capability.ENV_WRITE);
    }

    const denied = required.filter((cap) => !this.permissions.check(spec.id, cap).allowed);

    return { allowed: denied.length === 0, denied };
  }

  /** Throws if the spec is not allowed to run. Call this at the top of ProcessManager.start(). */
  enforce(spec: ProcessSpec): void {
    const result = this.checkSpec(spec);
    if (!result.allowed) {
      throw new Error(
        `Sandbox: process "${spec.id}" denied -- missing capabilities: ${result.denied.join(", ")}`
      );
    }
  }
}
