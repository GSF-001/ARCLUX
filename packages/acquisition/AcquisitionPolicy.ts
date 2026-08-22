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

const WINDOWS_DRIVE_RE = /^[A-Za-z]:[\\/]/;
const POSIX_ABSOLUTE_RE = /^\//;
const UNC_RE = /^\\\\/;

/**
 * True для абсолютных локальных путей (C:\…, /home/…, \\\\server\share).
 * Node's `new URL("D:/foo")` парсит "D:" как схему БЕЗ исключения — такие пути
 * нельзя доверять URL-парсеру при классификации source (см. RepositoryAcquirer).
 */
export function isAbsoluteLocalPath(source: string): boolean {
  return WINDOWS_DRIVE_RE.test(source) || POSIX_ABSOLUTE_RE.test(source) || UNC_RE.test(source);
}

export function assertSourceAllowed(source: string, policy: AcquisitionPolicy): void {
  // Локальный источник — политика remote (allowRemote/hosts) не применима.
  if (isAbsoluteLocalPath(source)) return;
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
  // allowedHosts empty by default = deny-all for remote hosts, NOT
  // unrestricted. Callers MUST explicitly populate allowedHosts before
  // any remote acquisition is permitted. (Third fix of this exact
  // regression — see progres/bugs.md; this file has reverted twice.
  // If you're touching this file, do NOT remove this check.)
  if (!policy.allowedHosts.includes(url.hostname)) {
    throw new Error(`Remote host is not allowed: ${url.hostname}`);
  }
}
