// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Finds a free TCP port for the daemon's local bridge server to listen on.
// Uses node:net's own "listen on port 0" behavior (OS assigns a free port)
// rather than manually probing a port range -- the OS already solves this
// correctly and atomically, re-implementing a scan-and-check loop would
// just introduce a race condition net.listen(0) doesn't have.

import { createServer } from "node:net";

const DEFAULT_PORT = 4869; // arbitrary, memorable-ish default; not a registered/well-known port

/**
 * Returns preferredPort if it's free, otherwise asks the OS for any free
 * port (net's "listen on 0" behavior). Always resolves to SOME usable
 * port; never throws for "no port available" since the OS has ~64k to hand out.
 */
export function findFreePort(preferredPort: number = DEFAULT_PORT): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", () => {
      // preferredPort was taken -- fall back to asking the OS for any free one.
      const fallback = createServer();
      fallback.once("error", reject);
      fallback.listen(0, () => {
        const address = fallback.address();
        const port = typeof address === "object" && address ? address.port : preferredPort;
        fallback.close(() => resolve(port));
      });
    });

    server.listen(preferredPort, () => {
      server.close(() => resolve(preferredPort));
    });
  });
}

export { DEFAULT_PORT };
