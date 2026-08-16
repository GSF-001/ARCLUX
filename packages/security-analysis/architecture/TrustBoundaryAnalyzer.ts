// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Trust-boundary analysis over the import graph. Zones are classified
// from module paths (directory segments + file-name suffixes), following
// the path-segment pattern already used by core's detectAmbiguousSymbolResolution
// (categorize()). Trust model (layered):
//
//   untrusted  — public-facing surface: api, routes, controllers, handlers,
//                pages, public dirs; *.controller.ts, *.handler.ts
//   boundary   — explicit adaptation layer: middleware, adapters, gateway,
//                proxies, interfaces
//   trusted    — internals holding sensitive data/logic: core, domain,
//                services, models, lib, db, auth, repositories
//
// Two violation rules:
//   1. untrusted -> trusted import WITHOUT an intermediate boundary layer:
//      untrusted input reaches trusted internals directly (high).
//   2. trusted -> untrusted import: trusted code depends on untrusted code
//      — inverted trust (medium).
//
// This is a STRUCTURAL triage: it says "an edge crosses the trust boundary",
// not "an exploit exists". Actual data flow is the job of the correlation
// layer (packages/correlation) and SensitiveDataFlowDetector.

import type { Repository } from "../../repository/Repository";
import type { ModuleInfo } from "../../shared/types";
import type { SecurityFinding, SecuritySeverity, SourceProvider } from "../types";

export interface TrustZoneDefinition {
  id: string;
  /** Exact path-segment names (case-insensitive) that put a module in this zone. */
  dirSegments: string[];
  /** File-name suffixes (case-insensitive) that put a module in this zone. */
  fileSuffixes: string[];
}

export type TrustZoneId = "untrusted" | "boundary" | "trusted";

export interface TrustBoundaryOptions {
  /** Custom zone definitions — replaces the default set when provided. */
  zones?: Record<TrustZoneId, TrustZoneDefinition>;
}

export const DEFAULT_TRUST_ZONES: Record<TrustZoneId, TrustZoneDefinition> = {
  untrusted: {
    dirSegments: ["api", "routes", "controllers", "handlers", "pages", "public", "webhooks"],
    fileSuffixes: [".controller.", ".handler.", ".webhook."],
  },
  boundary: {
    dirSegments: ["middleware", "adapters", "gateway", "proxies", "interfaces", "port"],
    fileSuffixes: [".middleware.", ".adapter.", ".gateway."],
  },
  trusted: {
    dirSegments: ["core", "domain", "services", "models", "lib", "db", "auth", "internal", "repositories", "store"],
    fileSuffixes: [".service.", ".repository.", ".model.", ".store."],
  },
};

export function classifyTrustZone(relativePath: string, zones: Record<TrustZoneId, TrustZoneDefinition>): TrustZoneId | null {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split("/");
  const fileName = segments[segments.length - 1] ?? "";

  // Most specific (untrusted, boundary) checked before trusted: a file like
  // "controllers/admin.service.ts" is primarily a controller boundary face.
  for (const zoneId of ["untrusted", "boundary", "trusted"] as const) {
    const zone = zones[zoneId];
    if (segments.some((seg) => zone.dirSegments.includes(seg))) return zoneId;
    if (zone.fileSuffixes.some((suffix) => fileName.includes(suffix))) return zoneId;
  }
  return null;
}

export function detectTrustBoundaryViolations(
  repository: Repository,
  _sources: SourceProvider,
  options: TrustBoundaryOptions = {}
): SecurityFinding[] {
  const zones = options.zones ?? DEFAULT_TRUST_ZONES;
  const findings: SecurityFinding[] = [];

  for (const module of repository.getAllModules()) {
    const sourceZone = classifyTrustZone(module.file.relativePath, zones);
    if (!sourceZone) continue;

    for (const targetId of module.imports) {
      const target = repository.getModule(targetId);
      if (!target) continue;
      const targetZone = classifyTrustZone(target.file.relativePath, zones);
      if (!targetZone) continue;

      const severity = ruleSeverity(sourceZone, targetZone);
      if (!severity) continue;

      findings.push({
        id: `trust-boundary:${module.id}->${targetId}`,
        ruleId: "trust-boundary-import",
        title: `Trust boundary crossing (${sourceZone} -> ${targetZone})`,
        description: trustMessage(sourceZone, targetZone, module, target),
        severity,
        confidence: "medium",
        location: { moduleId: module.id, filePath: module.file.relativePath },
        cwe: ["CWE-501"], // Trust boundary violation
        owasp: ["A01:2025"], // Broken Access Control
      });
    }
  }

  return findings.sort((a, b) => a.location.filePath.localeCompare(b.location.filePath));
}

function ruleSeverity(sourceZone: TrustZoneId, targetZone: TrustZoneId): SecuritySeverity | null {
  if (sourceZone === "untrusted" && targetZone === "trusted") return "high";
  if (sourceZone === "trusted" && targetZone === "untrusted") return "medium";
  return null; // boundary edges and same-zone edges are allowed
}

function trustMessage(
  sourceZone: TrustZoneId,
  targetZone: TrustZoneId,
  source: ModuleInfo,
  target: ModuleInfo
): string {
  if (sourceZone === "untrusted" && targetZone === "trusted") {
    return `Public-facing "${source.file.relativePath}" imports trusted internals "${target.file.relativePath}" directly — untrusted input reaches trusted code without a boundary (adapter/middleware) layer.`;
  }
  return `Trusted code "${source.file.relativePath}" imports untrusted surface "${target.file.relativePath}" — inverted trust dependency.`;
}
