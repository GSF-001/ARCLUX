// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * ArchiveSourceAdapter — adapts an archive (URL or local file: .zip,
 * .tar.gz, .tgz) into a RemoteSource. Remote archives pass the SSRF
 * guard; local archives pass the source boundary.
 */

import { resolve } from "node:path";
import { homedir } from "node:os";
import type { RemoteSource } from "../remote/RemoteSource";
import type { SourceAdapter } from "./LocalSourceAdapter";
import { RemoteAccessPolicy } from "../boundaries/RemoteAccessPolicy";
import { SourceBoundaryPolicy } from "../boundaries/SourceBoundaryPolicy";

const ARCHIVE_EXT = /\.(?:zip|tar\.gz|tgz|tar|gz)$/i;
const REMOTE_PREFIX = /^(?:https?|ssh|git):\/\//i;

export class ArchiveSourceAdapter implements SourceAdapter {
  readonly kind = "archive" as const;

  matches(input: string): boolean {
    return ARCHIVE_EXT.test(input);
  }

  toRemoteSource(input: string): RemoteSource {
    if (REMOTE_PREFIX.test(input)) {
      RemoteAccessPolicy.default().assert(input);
      return { id: `archive:${input}`, url: input };
    }
    const expanded = input === "~" ? homedir() : input.startsWith("~/") ? `${homedir()}/${input.slice(2)}` : input;
    const path = resolve(expanded);
    new SourceBoundaryPolicy().assert(path);
    return { id: `archive:${path}`, localPath: path };
  }
}