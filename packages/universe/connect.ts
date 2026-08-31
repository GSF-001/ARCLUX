// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// Milestone 1 — `arclux connect` boilerplate generator (Layer A / Layer D).
//
// Writes a starter `.arclux/` manifest into the USER's repository. When the
// user later runs the analysis + buildVesselModel flow, overrides and
// components here are validated (schema.ts) and license-checked (license.ts)
// before taking effect. Never writes into ARCLUX's own repo.

import * as fs from "node:fs";
import * as path from "node:path";

import type { ArcluxManifest, LicenseTier, SubsystemId } from "./types";

export interface ConnectOptions {
  /** Absolute path to the target repo's root. */
  rootPath: string;
  vesselName?: string;
  license?: LicenseTier;
  owner?: string;
  /** If true, overwrite an existing manifest. */
  force?: boolean;
}

export interface ConnectResult {
  created: string[];
  manifestPath: string;
  arcluxDir: string;
  skipped: boolean;
}

const ARCLUX_BOOTSTRAP = `# ARCLUX Vessel
#
# This directory is the user-authored definition of your vessel. Everything
# here lives in YOUR repository (source of truth) and is validated by ARCLUX
# before it affects the live VesselModel. State (health/damage) is generated
# by ARCLUX and stored separately under .arclux/state/.
#
# License tiers:
#   open    - reusable by anyone under its terms
#   shared  - needs attribution / permission
#   private - owner + explicitly authorized only
`;

const SYSTEMS_BOOTSTRAP = `# Subsystem definitions. Each subsystem maps to part of your codebase
# and is scored automatically by ARCLUX analysis (then merged with any
# validated override).
#
#   engine      - graph structure / navigation throughput
#   reactor     - structural integrity / impact tracing
#   navigation  - reverse-dependency reach
#   defense     - security posture / attack surface
#   weapons     - exposed capability from analysis
#   ai          - (reserved) detector/hook intelligence
`;

const BOOTSTRAP_COMPONENTS = `# Component capabilities.
# Each component binds a real capability (SDK/MCP function) to your vessel.
# License is enforced by the World Validator (3-tier).
#
#   { "id": "security-scanner", "capability": "security.scan",
#     "license": "open", "owner": "", "provenance": [] }
`;

const BOOTSTRAP_STATE = `# ARCLUX-generated live state (health/damage per subsystem).
# This is NOT user-authored - ARCLUX writes it here, versioned, so it is
# tracked by git and feeds provenance/history. Do not hand-edit.
`;

export function connectRepository(options: ConnectOptions): ConnectResult {
  const { rootPath, vesselName, license = "open", owner, force = false } = options;

  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
    throw new Error(`Not a directory: ${rootPath}`);
  }

  const arcluxDir = path.join(rootPath, ".arclux");
  const manifestPath = path.join(arcluxDir, "arclux.json");
  const systemsDir = path.join(arcluxDir, "systems");
  const componentsDir = path.join(arcluxDir, "components");
  const stateDir = path.join(arcluxDir, "state");

  if (!force && fs.existsSync(manifestPath)) {
    return {
      created: [],
      manifestPath,
      arcluxDir,
      skipped: true,
    };
  }

  fs.mkdirSync(systemsDir, { recursive: true });
  fs.mkdirSync(componentsDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });

  const name = vesselName ?? path.basename(rootPath);
  const manifest: ArcluxManifest = {
    formatVersion: 1,
    name,
    license,
    ...(owner ? { owner } : {}),
  };

  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest }, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(arcluxDir, "README.md"), ARCLUX_BOOTSTRAP, "utf8");
  fs.writeFileSync(path.join(arcluxDir, "systems", "README.md"), SYSTEMS_BOOTSTRAP, "utf8");
  fs.writeFileSync(path.join(arcluxDir, "components", "README.md"), BOOTSTRAP_COMPONENTS, "utf8");
  fs.writeFileSync(path.join(arcluxDir, "state", "README.md"), BOOTSTRAP_STATE, "utf8");

  // A sample subsystem file so users see the shape.
  const sampleSystems = sampleSystemsManifest();
  fs.writeFileSync(path.join(systemsDir, "engine.arclux.json"), JSON.stringify(sampleSystems.engine, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(systemsDir, "defense.arclux.json"), JSON.stringify(sampleSystems.defense, null, 2) + "\n", "utf8");

  return {
    created: [
      manifestPath,
      path.join(arcluxDir, "README.md"),
      path.join(systemsDir, "README.md"),
      path.join(systemsDir, "engine.arclux.json"),
      path.join(systemsDir, "defense.arclux.json"),
      path.join(componentsDir, "README.md"),
      path.join(stateDir, "README.md"),
    ],
    manifestPath,
    arcluxDir,
    skipped: false,
  };
}

interface SampleSystems {
  engine: Record<string, unknown>;
  defense: Record<string, unknown>;
}

function sampleSystemsManifest(): SampleSystems {
  return {
    engine: {
      id: "engine",
      label: "Engine",
      capability: "graph.navigation",
      baseStat: 50,
      description: "Graph structure & navigation throughput",
    },
    defense: {
      id: "defense",
      label: "Defense",
      capability: "security.scan",
      baseStat: 50,
      description: "Security posture & attack surface",
    },
  };
}

export const SUBSYSTEM_IDS: SubsystemId[] = [
  "engine",
  "reactor",
  "navigation",
  "defense",
  "weapons",
  "ai",
];
