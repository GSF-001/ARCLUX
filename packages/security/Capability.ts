// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pattern reference: Linux include/uapi/linux/capability.h. Two ideas
// ported: (1) granular named capabilities instead of a single root/non-root
// bit, (2) the three-set model (permitted / effective / inheritable).
// Hardware/kernel-specific capabilities (CAP_NET_ADMIN, CAP_SYS_BOOT,
// CAP_MKNOD, etc) deliberately NOT ported -- ARCLUX processes are Node
// child processes (see packages/runtime/ProcessSpec.ts), not kernel-level
// actors. Capabilities here map to what a ProcessSpec can actually do:
// run a command, read/write a working directory, read/inject env vars.

export const Capability = {
  /** run the process's command at all */
  EXEC: "exec",
  /** read files under the process's cwd */
  FS_READ: "fs:read",
  /** write files under the process's cwd */
  FS_WRITE: "fs:write",
  /** read the process's own env vars */
  ENV_READ: "env:read",
  /** inject/override env vars for the process */
  ENV_WRITE: "env:write",
  /** send IPC messages to the process (see ProcessManager.send) */
  IPC_SEND: "ipc:send",
  /** kill/stop the process */
  PROCESS_KILL: "process:kill",
} as const;

export type CapabilityValue = (typeof Capability)[keyof typeof Capability];

/**
 * Three-set model, mirrors struct __user_cap_data_struct's
 * permitted/effective/inheritable split:
 * - permitted: capabilities this subject is ALLOWED to hold
 * - effective: capabilities CURRENTLY active (must be a subset of permitted)
 * - inheritable: capabilities passed down to spawned child processes
 */
export interface CapabilitySet {
  permitted: Set<CapabilityValue>;
  effective: Set<CapabilityValue>;
  inheritable: Set<CapabilityValue>;
}

export function createCapabilitySet(permitted: CapabilityValue[] = []): CapabilitySet {
  const permittedSet = new Set(permitted);
  return {
    permitted: permittedSet,
    effective: new Set(permittedSet),
    inheritable: new Set(),
  };
}

export function hasCapability(set: CapabilitySet, cap: CapabilityValue): boolean {
  return set.effective.has(cap);
}

/** Drop a capability from effective (and permitted, matching Linux: once dropped from permitted it can't be re-added without a fresh grant). */
export function dropCapability(set: CapabilitySet, cap: CapabilityValue): CapabilitySet {
  const permitted = new Set(set.permitted);
  const effective = new Set(set.effective);
  permitted.delete(cap);
  effective.delete(cap);
  return { ...set, permitted, effective };
}

/** Mark a capability as inheritable, so child processes spawned from this subject receive it. */
export function markInheritable(set: CapabilitySet, cap: CapabilityValue): CapabilitySet {
  if (!set.permitted.has(cap)) return set;
  const inheritable = new Set(set.inheritable);
  inheritable.add(cap);
  return { ...set, inheritable };
}

/** Derive the capability set a child process inherits from its parent -- only the inheritable subset becomes the child's permitted+effective set. */
export function deriveChildCapabilitySet(parent: CapabilitySet): CapabilitySet {
  return createCapabilitySet([...parent.inheritable]);
}
