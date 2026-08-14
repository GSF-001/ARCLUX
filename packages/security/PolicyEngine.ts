// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Evaluates whether an action is allowed given a CapabilitySet. Deliberately
// simple (no MAC/LSM-style pluggable policy modules like Linux's
// CAP_MAC_OVERRIDE/CAP_MAC_ADMIN suggest) -- ARCLUX has one policy model,
// not a framework for swapping policy backends.

import { hasCapability, type CapabilitySet, type CapabilityValue } from "./Capability";

export interface PolicyDecision {
  allowed: boolean;
  capability: CapabilityValue;
  reason: string;
}

export function evaluate(set: CapabilitySet, capability: CapabilityValue): PolicyDecision {
  const allowed = hasCapability(set, capability);
  return {
    allowed,
    capability,
    reason: allowed
      ? `"${capability}" is in the effective capability set`
      : `"${capability}" is not in the effective capability set`,
  };
}

/** Evaluates multiple capabilities at once, all must be allowed. */
export function evaluateAll(set: CapabilitySet, capabilities: CapabilityValue[]): PolicyDecision[] {
  return capabilities.map((cap) => evaluate(set, cap));
}

export function requireCapability(set: CapabilitySet, capability: CapabilityValue): void {
  const decision = evaluate(set, capability);
  if (!decision.allowed) {
    throw new Error(`Policy violation: ${decision.reason}`);
  }
}
