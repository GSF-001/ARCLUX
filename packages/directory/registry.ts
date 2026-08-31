// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// registry.ts — Directory registry live (register/heartbeat/list/get) — DIRECTORY ≠ AUTHORITY.

import type { ServerHealth, ServerIdentity, ServerManifest, ServerStatus } from "./types";

const servers = new Map<string, ServerManifest>();
const health = new Map<string, ServerHealth>();
const identity = new Map<string, ServerIdentity>();

export function registerServer(manifest: ServerManifest, id?: ServerIdentity): { ok: boolean; reason?: string } {
  if (!manifest.serverId || !manifest.endpoint) return { ok: false, reason: "serverId/endpoint required" };
  const verOk = isCompatible(manifest.version);
  if (!verOk) return { ok: false, reason: `incompatible version ${manifest.version}` };
  servers.set(manifest.serverId, { ...manifest });
  if (id) identity.set(manifest.serverId, { ...id });
  health.set(manifest.serverId, { serverId: manifest.serverId, status: "ONLINE", population: manifest.population ?? 0, regions: manifest.regions, federation: manifest.federation, updatedAt: new Date().toISOString() });
  return { ok: true };
}

export function unregisterServer(serverId: string): boolean { return servers.delete(serverId) && health.delete(serverId); }

export function heartbeat(serverId: string, h: Partial<ServerHealth>): ServerHealth | null {
  const cur = health.get(serverId);
  if (!cur) return null;
  const next: ServerHealth = { ...cur, ...h, serverId, updatedAt: new Date().toISOString() } as ServerHealth;
  health.set(serverId, next);
  const m = servers.get(serverId);
  if (m && typeof h.population === "number") m.population = h.population;
  return { ...next };
}

export function listServers(filter?: { visibility?: string; federation?: string; status?: ServerStatus }): ServerManifest[] {
  let out = Array.from(servers.values());
  if (filter?.visibility) out = out.filter((s) => s.visibility === filter.visibility);
  if (filter?.federation) out = out.filter((s) => s.federation === filter.federation);
  if (filter?.status) out = out.filter((s) => health.get(s.serverId)?.status === filter.status);
  return out.map((s) => ({ ...s }));
}

export function getServer(serverId: string): { manifest?: ServerManifest; health?: ServerHealth; identity?: ServerIdentity } {
  return { manifest: servers.get(serverId) ? { ...servers.get(serverId)! } : undefined, health: health.get(serverId) ? { ...health.get(serverId)! } : undefined, identity: identity.get(serverId) ? { ...identity.get(serverId)! } : undefined };
}

export function getHealth(serverId: string): ServerHealth | undefined { const h = health.get(serverId); return h ? { ...h } : undefined; }

function isCompatible(version: string): boolean {
  // Simple: 0.x compatible with 0.x, major mismatch rejected
  if (!version) return false;
  const major = version.split(".")[0];
  return major === "0" || major === "1";
}

export function clearDirectory(): void { servers.clear(); health.clear(); identity.clear(); }
