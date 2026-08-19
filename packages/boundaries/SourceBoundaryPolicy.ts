// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * SourceBoundaryPolicy — decides WHERE ARCLUX is allowed to look.
 *
 * Mechanism, not policy: the class ships with permissive defaults (any
 * local directory is analyzable) and enforces whatever the caller
 * configures on top (allowed roots, deny roots, remote allowance). The
 * two hard rules that always apply are safety rules, not policy choices:
 *   1. Windows drive paths and UNC paths must not be misinterpreted as
 *      URLs (the Node URL parser accepts "D:/foo" without throwing).
 *   2. Local analysis must not escape an allowed root through symlinks
 *      (realpath containment check).
 */

import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { isAbsoluteLocalPath } from "../acquisition/AcquisitionPolicy";

export type SourceKind = "local" | "remote-git" | "unknown";

export interface SourceBoundaryViolation {
  source: string;
  reason: string;
}

export interface SourceBoundaryPolicyOptions {
  /** If set, local sources must resolve inside one of these roots. */
  allowedRoots?: string[];
  /** Local sources resolving inside any of these are rejected. */
  denyRoots?: string[];
  /** When false, remote git URLs are rejected. Default true. */
  allowRemote?: boolean;
}

const REMOTE_GIT_RE = /^(https?|ssh|git):\/\//;

export class SourceBoundaryPolicy {
  private readonly allowedRoots: string[];
  private readonly denyRoots: string[];
  private readonly allowRemote: boolean;

  constructor(options: SourceBoundaryPolicyOptions = {}) {
    // Roots are realpath'd up front: /tmp is a symlink on Termux, so a
    // textual comparison against "/tmp/..." would reject every path under
    // it (or worse, accept an escape). Compare real locations.
    this.allowedRoots = (options.allowedRoots ?? []).map((p) => realpathOr(p));
    this.denyRoots = (options.denyRoots ?? []).map((p) => realpathOr(p));
    this.allowRemote = options.allowRemote ?? true;
  }

  classify(source: string): SourceKind {
    if (REMOTE_GIT_RE.test(source)) return "remote-git";
    if (isAbsoluteLocalPath(source) || !source.includes("://")) return "local";
    return "unknown";
  }

  /** Returns every violation for a source. Empty array = allowed. */
  check(source: string): SourceBoundaryViolation[] {
    const kind = this.classify(source);
    const violations: SourceBoundaryViolation[] = [];

    if (kind === "unknown") {
      return [{ source, reason: `unrecognized source kind: ${source}` }];
    }

    if (kind === "remote-git") {
      if (!this.allowRemote) {
        violations.push({ source, reason: "remote git sources are disabled by policy" });
      }
      return violations;
    }

    // ── local ────────────────────────────────────────────────
    const resolved = resolve(source);

    for (const denied of this.denyRoots) {
      if (isWithin(resolved, denied)) {
        violations.push({ source, reason: `resolves inside a denied root: ${denied}` });
      }
    }

    if (this.allowedRoots.length > 0) {
      const inside = this.allowedRoots.some((root) => isWithin(resolved, root));
      if (!inside) {
        violations.push({ source, reason: `outside every allowed root (${this.allowedRoots.join(", ")})` });
      }
    }

    // Symlink containment: a path that is textually inside an allowed root
    // can still point OUTSIDE it through a symlink. realpath resolves the
    // actual location; if it escapes every allowed root, reject. Only
    // needed when the textual path passed the allowed-roots check — a path
    // that is already outside is reported once, not twice.
    if (this.allowedRoots.length > 0) {
      const containingRoot = this.allowedRoots.find((root) => isWithin(resolved, root));
      if (containingRoot !== undefined) {
        let actual: string;
        try {
          actual = realpathSync(resolved);
        } catch {
          actual = resolved;
        }
        if (!this.allowedRoots.some((root) => isWithin(actual, root))) {
          violations.push({ source, reason: `resolves through symlinks to: ${actual} — outside allowed roots` });
        }
      }
    }

    return violations;
  }

  /** Throws on the first violation. */
  assert(source: string): void {
    const violations = this.check(source);
    if (violations.length > 0) {
      throw new Error(`Source boundary violation: ${violations[0].reason} (${source})`);
    }
  }
}

function isWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel) && !rel.split(sep).includes(".."));
}

function realpathOr(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}