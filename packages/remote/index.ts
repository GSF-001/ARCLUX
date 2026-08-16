// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Clean package exports — consumers import from "../remote" instead of
// reaching into individual files.

export type { RemoteSource } from "./RemoteSource";
export { RemoteRepository } from "./RemoteRepository";
export {
  createRemoteSnapshot,
  type RemoteSnapshot,
  type CreateRemoteSnapshotInput,
} from "./RemoteSnapshot";
