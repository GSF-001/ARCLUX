// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * LocalSourceAdapter — adapts a local directory path into a RemoteSource
 * and applies the source boundary (allowed roots, deny roots, symlink
 * containment) before the analysis flow touches it.
 */

import { resolve } from "node:path";
import { homedir } from "node:os";
import { statSync } from "node:fs";
import type { RemoteSource } from "../remote/RemoteSource";
import { SourceBoundaryPolicy } from "../boundaries/SourceBoundaryPolicy";

export interface SourceAdapter {
  readonly kind: "local" | "github" | "gitlab" | "archive" | "remote";
  /** True when this adapter can handle the given input string. */
  matches(input: string): boolean;
  /** Normalizes input into a RemoteSource, throwing on boundary violations. */
  toRemoteSource(input: string): RemoteSource;
}

export class LocalSourceAdapter implements SourceAdapter {
  readonly kind = "local" as const;

  matches(input: string): boolean {
    if (LocalSourceAdapter.isRemoteUrl(input)) return false;
    try {
      return statSync(LocalSourceAdapter.expand(input)).isDirectory();
    } catch {
      return false;
    }
  }

  toRemoteSource(input: string): RemoteSource {
    const path = resolve(LocalSourceAdapter.expand(input));
    const boundary = new SourceBoundaryPolicy();
    boundary.assert(path);
    return { id: `local:${path}`, localPath: path };
  }

  /** Termux has no /tmp — paths like "~/repo" must expand to $HOME. */
  private static expand(input: string): string {
    if (input === "~") return homedir();
    if (input.startsWith("~/")) return `${homedir()}/${input.slice(2)}`;
    return input;
  }

  private static isRemoteUrl(input: string): boolean {
    return /^(?:https?|ssh|git):\/\//i.test(input) || /^(?:git@|github:|gitlab:)/i.test(input);
  }
}
