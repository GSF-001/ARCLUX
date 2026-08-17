// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface AcquisitionPolicy {
  allowRemote: boolean;
  allowedHosts: string[];
  maxBytes: number;
  timeoutMs: number;
}

export const defaultAcquisitionPolicy: AcquisitionPolicy = {
  allowRemote: true,
  allowedHosts: [],
  maxBytes: 100 * 1024 * 1024,
  timeoutMs: 30_000,
};

export function resolveAcquisitionPolicy(
  policy: Partial<AcquisitionPolicy> = {},
): AcquisitionPolicy {
  const resolved = { ...defaultAcquisitionPolicy, ...policy };
  if (!Number.isFinite(resolved.maxBytes) || resolved.maxBytes <= 0) {
    throw new Error("Acquisition policy maxBytes must be greater than zero.");
  }
  if (!Number.isFinite(resolved.timeoutMs) || resolved.timeoutMs <= 0) {
    throw new Error("Acquisition policy timeoutMs must be greater than zero.");
  }
  return { ...resolved, allowedHosts: [...resolved.allowedHosts] };
}

export function assertSourceAllowed(source: string, policy: AcquisitionPolicy): void {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return;
  }

  if (!policy.allowRemote) throw new Error("Remote acquisition is disabled by policy.");
  if (!["http:", "https:", "ssh:", "git:", "ftp:"].includes(url.protocol)) {
    throw new Error(`Remote protocol is not allowed: ${url.protocol}`);
  }
  if (policy.allowedHosts.length > 0 && !policy.allowedHosts.includes(url.hostname)) {
    throw new Error(`Remote host is not allowed: ${url.hostname}`);
  }
}
