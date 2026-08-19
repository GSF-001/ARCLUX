// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * GitLabSourceAdapter — adapts a GitLab repository (https, ssh, or the
 * SCP-style git@gitlab.com:org/repo.git shorthand) into a RemoteSource.
 * Same SSRF guard as the GitHub adapter: the remote access policy is
 * asserted before the source is accepted.
 */

import type { RemoteSource } from "../remote/RemoteSource";
import type { SourceAdapter } from "./LocalSourceAdapter";
import { RemoteAccessPolicy } from "../boundaries/RemoteAccessPolicy";

const GITLAB_URL = /^https?:\/\/(?:www\.)?gitlab\.com\//i;
const GITLAB_SSH = /^ssh:\/\/git@gitlab\.com\//i;
const GITLAB_SCP = /^git@gitlab\.com:/i;

export class GitLabSourceAdapter implements SourceAdapter {
  readonly kind = "gitlab" as const;

  matches(input: string): boolean {
    return GITLAB_URL.test(input) || GITLAB_SSH.test(input) || GITLAB_SCP.test(input);
  }

  toRemoteSource(input: string): RemoteSource {
    const url = input.replace(/^git@gitlab\.com:/, "ssh://git@gitlab.com/");
    RemoteAccessPolicy.default().assert(url);
    return { id: `gitlab:${url}`, url, branch: undefined };
  }
}
