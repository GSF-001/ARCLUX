// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * GitHubSourceAdapter — adapts a GitHub repository (https, ssh, or the
 * SCP-style git@github.com:org/repo.git shorthand) into a RemoteSource.
 * The SSRF guard runs before anything else so the analysis flow never
 * reaches a host that failed the remote access policy.
 */

import type { RemoteSource } from "../remote/RemoteSource";
import type { SourceAdapter } from "./LocalSourceAdapter";
import { RemoteAccessPolicy } from "../boundaries/RemoteAccessPolicy";

const GITHUB_URL = /^https?:\/\/(?:www\.)?github\.com\//i;
const GITHUB_SSH = /^ssh:\/\/git@github\.com\//i;
const GITHUB_SCP = /^git@github\.com:/i;

export class GitHubSourceAdapter implements SourceAdapter {
  readonly kind = "github" as const;

  matches(input: string): boolean {
    return GITHUB_URL.test(input) || GITHUB_SSH.test(input) || GITHUB_SCP.test(input);
  }

  toRemoteSource(input: string): RemoteSource {
    const url = input.replace(/^git@github\.com:/, "ssh://git@github.com/");
    RemoteAccessPolicy.default().assert(url);
    return { id: `github:${url}`, url, branch: undefined };
  }
}
