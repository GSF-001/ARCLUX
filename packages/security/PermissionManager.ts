// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Maps a process id (see packages/runtime/ProcessSpec.ts) to its
// CapabilitySet, and provides the check/require entry points other
// packages should call instead of touching CapabilitySet/PolicyEngine
// directly. Mirrors how Kernel.ts is the single entry point wrapping
// ProcessTable/SignalBus/ServiceRegistry.

import {
  createCapabilitySet,
  deriveChildCapabilitySet,
  type CapabilitySet,
  type CapabilityValue,
} from "./Capability";
import { evaluate, requireCapability, type PolicyDecision } from "./PolicyEngine";

export class PermissionManager {
  private sets = new Map<string, CapabilitySet>();

  /** Grant a process id a capability set. Call once, typically alongside Kernel.registerProcess. */
  grant(processId: string, capabilities: CapabilityValue[]): CapabilitySet {
    const set = createCapabilitySet(capabilities);
    this.sets.set(processId, set);
    return set;
  }

  /** Grant a process the capability set inherited from a parent process's inheritable set. */
  grantFromParent(processId: string, parentProcessId: string): CapabilitySet {
    const parentSet = this.sets.get(parentProcessId);
    const childSet = parentSet ? deriveChildCapabilitySet(parentSet) : createCapabilitySet();
    this.sets.set(processId, childSet);
    return childSet;
  }

  revoke(processId: string): boolean {
    return this.sets.delete(processId);
  }

  check(processId: string, capability: CapabilityValue): PolicyDecision {
    const set = this.sets.get(processId);
    if (!set) {
      return { allowed: false, capability, reason: `no capability set registered for process "${processId}"` };
    }
    return evaluate(set, capability);
  }

  /** Throws if the process doesn't have the capability. */
  require(processId: string, capability: CapabilityValue): void {
    const set = this.sets.get(processId);
    if (!set) {
      throw new Error(`Policy violation: no capability set registered for process "${processId}"`);
    }
    requireCapability(set, capability);
  }

  getCapabilitySet(processId: string): CapabilitySet | undefined {
    return this.sets.get(processId);
  }

  /** All registered capability sets, for aggregation (e.g. SystemState). */
  list(): { processId: string; set: CapabilitySet }[] {
    return [...this.sets.entries()].map(([processId, set]) => ({ processId, set }));
  }
}
