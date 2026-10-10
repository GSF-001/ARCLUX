// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Milestone 1 — License 3-tier validation (Layer C / K3).
//
//   🟢 open    — reusable by anyone under its terms
//   🟡 shared  — needs attribution / permission
//   🔴 private — owner + explicitly authorized only
//
// On failure, a private/shared capability is DISABLED (capability drops),
// never the code corrupted. This is the anti-abuse gate for component
// authorization (combat Layer I.6).

import type { ComponentBinding, LicenseTier } from "./types";

export type LicenseDecision = "authorized" | "disabled";

export interface LicenseCheck {
  componentId: string;
  tier: LicenseTier;
  decision: LicenseDecision;
  reason: string;
}

export interface AuthorizationContext {
  /** The acting identity (owner handle). */
  actor: string;
  /** Components the actor explicitly owns. */
  ownedComponentIds?: string[];
  /** Any explicit grants (attribution/permission given). */
  grantedComponentIds?: string[];
}

/**
 * Decide whether an actor may use a given component under its license tier.
 * Deterministic — the same inputs always yield the same decision, so it can
 * run server-side as part of the World Validator without ambiguity.
 */
export function checkComponent(
  component: ComponentBinding,
  ctx: AuthorizationContext
): LicenseCheck {
  const actorIsOwner = component.owner === ctx.actor;
  const explicitlyGranted = (component.owner !== "") &&
    (ctx.grantedComponentIds?.includes(component.id) === true);

  switch (component.license) {
    case "open":
      return { componentId: component.id, tier: component.license, decision: "authorized", reason: "Open license — usable by anyone" };
    case "shared": {
      if (actorIsOwner) return { componentId: component.id, tier: component.license, decision: "authorized", reason: "Owner" };
      if (ctx.ownedComponentIds?.includes(component.id)) return { componentId: component.id, tier: component.license, decision: "authorized", reason: "Owned" };
      if (explicitlyGranted) return { componentId: component.id, tier: component.license, decision: "authorized", reason: "Explicit grant present" };
      return { componentId: component.id, tier: component.license, decision: "disabled", reason: "Shared license requires attribution/permission" };
    }
    case "private": {
      if (actorIsOwner) return { componentId: component.id, tier: component.license, decision: "authorized", reason: "Owner" };
      if (explicitlyGranted) return { componentId: component.id, tier: component.license, decision: "authorized", reason: "Explicit grant present" };
      return { componentId: component.id, tier: component.license, decision: "disabled", reason: "Private — owner or authorized only" };
    }
  }
}

/**
 * Validate an entire VesselModel's component set for a given actor. Returns
 * only the authorized bindings plus a report of what was disabled (so the UI
 * can explain capability loss without exposing private internals).
 */
export function validateVesselComponents(
  components: ComponentBinding[],
  ctx: AuthorizationContext
): { authorized: ComponentBinding[]; report: LicenseCheck[] } {
  const authorized: ComponentBinding[] = [];
  const report: LicenseCheck[] = [];
  for (const c of components) {
    const check = checkComponent(c, ctx);
    report.push(check);
    if (check.decision === "authorized") authorized.push(c);
  }
  return { authorized, report };
}

/**
 * The per-component cap for user overrides. Overrides are bounded relative
 * to the engine-derived base, so no repo can be pumped beyond what the code
 * actually supports (K1-C anti-abuse).
 */
export const OVERRIDE_CAP_OFFSET = 10;
