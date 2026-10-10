// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Transport.ts — shared transport contracts for ARCLUX MMO (D-008/D-009).
// Defines client↔server contracts used by both in-process and HTTP transports.
// No logic — only types. Implementations are in InProcessTransport.ts & HttpTransport.ts.

import type { GameEvent, PlayerIntent, RegionSnapshot } from "../types";

export type { RegionSnapshot };

export interface NetworkHandoff {
  vesselId: string;
  owner?: string;
  position?: { x: number; y: number; z: number };
  vessel: import("../../universe/types").VesselModel;
}

export interface TransportClient {
  requestSnapshot(): Promise<RegionSnapshot>;
  deliver(h: NetworkHandoff): Promise<{ ok: boolean; reason?: string }>;
}

export type NetEvent = GameEvent;

export interface NetcodeTransport {
  sendIntent(intent: PlayerIntent): void;
  tick(): void;
  requestSnapshot(): RegionSnapshot | undefined;
  onEvent(handler: (ev: NetEvent) => void): void;
  deliver(h: NetworkHandoff): Promise<{ ok: boolean; reason?: string }>;
}

export interface NetcodeOptions {
  engine: import("../simulation").SimulationEngine;
}

export interface HttpServerTransport {
  url: string;
  listen(): Promise<void>;
  close(): Promise<void>;
}

export interface TransportConfig {
  kind: "in-process" | "http";
  port?: number;
  url?: string;
}
