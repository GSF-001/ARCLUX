/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * ProcessSpec — declarative shape describing how to spawn one process.
 * Scoped-down equivalent of PM2's pm2_env for fork mode (see
 * lib/God/ForkMode.js): keeps command/args/cwd/env/autorestart, drops
 * PM2-specific fields not relevant to ARCLUX (log file paths, pidfile
 * path, uid/gid, windowsHide, versioning/vizion).
 */

export interface ProcessSpec {
  id: string;
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  autorestart?: boolean;
  maxRestarts?: number;
}
