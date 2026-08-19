// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * RemoteAccessPolicy — decides WHERE remote acquisition may reach.
 *
 * The non-negotiable part is the SSRF guard: an analysis tool that clones
 * attacker-supplied URLs must not be tricked into hitting private
 * networks, link-local addresses, or cloud metadata endpoints
 * (169.254.169.254). Everything else (host/protocol allowlists) is
 * mechanism, configured by the caller.
 */

import { isIP } from "node:net";

export interface RemoteAccessViolation {
  url: string;
  reason: string;
}

export interface RemoteAccessPolicyOptions {
  /** If set, only these hostnames are allowed. */
  allowedHosts?: string[];
  /** Hostnames explicitly rejected even if allowlisted. */
  blockedHosts?: string[];
  /** Allowed protocols. Default: http:, https:, ssh:, git:. */
  allowedProtocols?: string[];
  /** Reject IPs in private/reserved ranges and the metadata endpoint. */
  blockPrivateNetworks?: boolean;
  /** Reject URLs longer than this. Default 2048. */
  maxUrlLength?: number;
}

const DEFAULT_PROTOCOLS = ["http:", "https:", "ssh:", "git:"];

function isPrivateAddress(hostname: string): boolean {
  // URL.hostname keeps the brackets on IPv6 literals ("[::1]"), strip them
  // before any classification so isIP sees the raw address.
  const bare = hostname.replace(/^\[|\]$/g, "");
  const ip = isIP(bare);
  if (ip === 0) return false; // hostname, not an IP literal

  if (ip === 4) {
    const parts = bare.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 0) return true; // 0.0.0.0/8
    if (a >= 224) return true; // multicast/reserved
    return false;
  }

  // IPv6: loopback, link-local, unique-local, unspecified, multicast.
  return (
    bare === "::1" ||
    bare.startsWith("fe80:") ||
    bare.startsWith("fc") ||
    bare.startsWith("fd") ||
    bare.startsWith("::") ||
    bare.startsWith("ff")
  );
}

export class RemoteAccessPolicy {
  private readonly allowedHosts: string[];
  private readonly blockedHosts: string[];
  private readonly allowedProtocols: string[];
  private readonly blockPrivateNetworks: boolean;
  private readonly maxUrlLength: number;

  constructor(options: RemoteAccessPolicyOptions = {}) {
    this.allowedHosts = options.allowedHosts ?? [];
    this.blockedHosts = options.blockedHosts ?? [];
    this.allowedProtocols = options.allowedProtocols ?? DEFAULT_PROTOCOLS;
    this.blockPrivateNetworks = options.blockPrivateNetworks ?? true;
    this.maxUrlLength = options.maxUrlLength ?? 2048;
  }

  static default(): RemoteAccessPolicy {
    return new RemoteAccessPolicy();
  }

  check(url: string): RemoteAccessViolation[] {
    const violations: RemoteAccessViolation[] = [];

    if (url.length > this.maxUrlLength) {
      violations.push({ url, reason: `URL exceeds max length (${this.maxUrlLength})` });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return [...violations, { url, reason: "not a parseable URL" }];
    }

    if (!this.allowedProtocols.includes(parsed.protocol)) {
      violations.push({ url, reason: `protocol not allowed: ${parsed.protocol}` });
    }

    if (this.blockedHosts.includes(parsed.hostname)) {
      violations.push({ url, reason: `host is blocked: ${parsed.hostname}` });
    }

    if (this.allowedHosts.length > 0 && !this.allowedHosts.includes(parsed.hostname)) {
      violations.push({ url, reason: `host not in allowlist: ${parsed.hostname}` });
    }

    if (this.blockPrivateNetworks && isPrivateAddress(parsed.hostname)) {
      violations.push({ url, reason: `private/reserved address blocked (SSRF guard): ${parsed.hostname}` });
    }

    return violations;
  }

  /** Throws on the first violation. */
  assert(url: string): void {
    const violations = this.check(url);
    if (violations.length > 0) {
      throw new Error(`Remote access violation: ${violations[0].reason} (${url})`);
    }
  }
}