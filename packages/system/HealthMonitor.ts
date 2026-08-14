/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Component health monitoring (issue #350). Each component registers a
// check: a synchronous function returning ok + an optional detail string.
// check() runs all checks and computes an overall status — a component is
// "degraded" (warning) or "down" (error) based on its check result, and
// any error makes the overall status "degraded" while any down makes it
// "down". Checks are deliberately synchronous and cheap (counts, has,
// exists) — they must not touch the network or the filesystem.

export type ComponentStatus = "ok" | "degraded" | "down";

export interface ComponentHealth {
  name: string;
  status: ComponentStatus;
  detail?: string;
}

export interface SystemHealth {
  overall: "ok" | "degraded" | "down";
  components: ComponentHealth[];
  checkedAt: number;
}

export type HealthCheck = () => { ok: boolean; detail?: string };

export class HealthMonitor {
  private checks = new Map<string, HealthCheck>();

  /** Registers (or replaces) a health check for a named component. */
  register(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  /** Runs all registered checks and produces the aggregate health. */
  check(): SystemHealth {
    const components: ComponentHealth[] = [];
    let hasDown = false;
    let hasDegraded = false;

    for (const [name, check] of this.checks) {
      try {
        const result = check();
        if (result.ok) {
          components.push({ name, status: "ok", detail: result.detail });
        } else {
          // A failing check is degraded (recoverable) unless it says down.
          // We don't have a tri-state return from checks, so map: not ok →
          // degraded, with the detail carrying why.
          hasDegraded = true;
          components.push({ name, status: "degraded", detail: result.detail ?? "check failed" });
        }
      } catch (err) {
        // A check that throws means the component is down, not just degraded.
        hasDown = true;
        components.push({
          name,
          status: "down",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      overall: hasDown ? "down" : hasDegraded ? "degraded" : "ok",
      components,
      checkedAt: Date.now(),
    };
  }
}
