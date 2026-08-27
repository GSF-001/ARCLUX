// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Milestone 1 — schema validation for `.arclux/arclux.json` (Layer 7,
// "Schema Validation" stage of the Vessel Validation Pipeline).
//
// Separate from the LicenseValidator: this validates SHAPE of the user
// manifest (schema + geometry-ish checks like caps), while license.ts decides
// AUTHORIZATION. Both feed the World Validator.

import type { ArcluxManifest, LicenseTier, SubsystemId } from "./types";
import { OVERRIDE_CAP_OFFSET } from "./license";

export interface ManifestIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ManifestValidation {
  valid: boolean;
  manifest?: ArcluxManifest;
  issues: ManifestIssue[];
}

const LICENSE_TIERS: LicenseTier[] = ["open", "shared", "private"];
const KNOWN_SUBSYSTEMS: SubsystemId[] = [
  "engine",
  "reactor",
  "navigation",
  "defense",
  "weapons",
  "ai",
];

export function validateManifest(raw: unknown): ManifestValidation {
  const issues: ManifestIssue[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, issues: [{ field: "$", message: "Manifest must be a JSON object", severity: "error" }] };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    issues.push({ field: "name", message: "name is required (non-empty string)", severity: "error" });
  }

  const license = obj.license as LicenseTier | undefined;
  if (license !== undefined && !LICENSE_TIERS.includes(license)) {
    issues.push({ field: "license", message: `license must be one of: ${LICENSE_TIERS.join(", ")}`, severity: "error" });
  }

  const override = obj.override;
  if (override !== undefined) {
    if (typeof override !== "object" || override === null || Array.isArray(override)) {
      issues.push({ field: "override", message: "override must be an object of subsystem -> 0..100", severity: "error" });
    } else {
      for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
        if (!KNOWN_SUBSYSTEMS.includes(key as SubsystemId)) {
          issues.push({ field: `override.${key}`, message: `unknown subsystem "${key}"`, severity: "warning" });
        }
        if (typeof value !== "number" || value < 0 || value > 100) {
          issues.push({ field: `override.${key}`, message: "override must be a number 0..100", severity: "error" });
        }
      }
    }
  }

  const components = obj.components;
  if (components !== undefined) {
    if (!Array.isArray(components)) {
      issues.push({ field: "components", message: "components must be an array", severity: "error" });
    } else {
      for (let i = 0; i < components.length; i++) {
        const c = components[i] as Record<string, unknown> | undefined;
        if (typeof c !== "object" || c === null) {
          issues.push({ field: `components[${i}]`, message: "component must be an object", severity: "error" });
          continue;
        }
        if (typeof c.id !== "string" || c.id === "") issues.push({ field: `components[${i}].id`, message: "id required", severity: "error" });
        if (typeof c.capability !== "string" || c.capability === "") issues.push({ field: `components[${i}].capability`, message: "capability required", severity: "error" });
        if (c.license !== undefined && !LICENSE_TIERS.includes(c.license as LicenseTier)) {
          issues.push({ field: `components[${i}].license`, message: "invalid license tier", severity: "error" });
        }
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    issues,
    manifest: obj as unknown as ArcluxManifest,
  };
}

/**
 * Cap enforcement for overrides given the engine base. Used by the connect
 * generator + validator so a huge override can't exceed base + OFFSET.
 * Returns the capped value.
 */
export function capOverride(base: number, proposed: number): number {
  return Math.max(0, Math.min(100, Math.min(proposed, base + OVERRIDE_CAP_OFFSET)));
}
