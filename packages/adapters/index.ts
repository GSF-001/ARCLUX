// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * SourceAdapter registry — routes any source string (local path, GitHub,
 * GitLab, archive, or any other public git/web host) to the right adapter
 * and normalizes it into a RemoteSource with its boundary check applied.
 *
 * The adapters keep the "who is allowed to reach where" decision in one
 * place: local paths go through SourceBoundaryPolicy, remote URLs go
 * through RemoteAccessPolicy (SSRF guard). Unknown public hosts still
 * work — they fall through to the generic remote adapter so ARCLUX is not
 * limited to github/gitlab.
 */

import type { RemoteSource } from "../remote/RemoteSource";
import type { SourceAdapter } from "./LocalSourceAdapter";
import { LocalSourceAdapter } from "./LocalSourceAdapter";
import { GitHubSourceAdapter } from "./GitHubSourceAdapter";
import { GitLabSourceAdapter } from "./GitLabSourceAdapter";
import { ArchiveSourceAdapter } from "./ArchiveSourceAdapter";
import { RemoteAccessPolicy } from "../boundaries/RemoteAccessPolicy";

const REMOTE_PREFIX = /^(?:https?|ssh|git):\/\//i;
const SCP_PREFIX = /^(?:git@|github:|gitlab:)/i;

/** Generic fallback so any other public host (bitbucket, self-hosted, …) works. */
class RemoteHostAdapter implements SourceAdapter {
  readonly kind = "remote" as const;
  matches(input: string): boolean {
    return REMOTE_PREFIX.test(input) || SCP_PREFIX.test(input);
  }
  toRemoteSource(input: string): RemoteSource {
    const url = SCP_PREFIX.test(input) ? input.replace(/^([^@]+@)([^:]+):/, "ssh://$1$2/") : input;
    RemoteAccessPolicy.default().assert(url);
    return { id: `remote:${url}`, url };
  }
}

const ADAPTERS: SourceAdapter[] = [
  new GitHubSourceAdapter(),
  new GitLabSourceAdapter(),
  new ArchiveSourceAdapter(),
  new LocalSourceAdapter(),
  new RemoteHostAdapter(),
];

/** Picks the first adapter that recognizes the input. */
export function createSourceAdapter(input: string): SourceAdapter {
  if (!input.trim()) throw new Error("Source cannot be empty.");
  const adapter = ADAPTERS.find((a) => a.matches(input));
  if (!adapter) throw new Error(`No source adapter understands: ${input}`);
  return adapter;
}

/**
 * Normalizes any source string into a RemoteSource with boundary checks
 * applied. This is the single entry the CLI/API use instead of calling
 * createRemoteSource directly.
 */
export function adaptSource(
  input: string,
  options: { id?: string } = {},
): RemoteSource {
  const adapter = createSourceAdapter(input);
  const source = adapter.toRemoteSource(input);
  return options.id ? { ...source, id: options.id } : source;
}

export type { SourceAdapter };