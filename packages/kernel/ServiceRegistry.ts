/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

export interface ServiceHandle {
  name: string;
  processId: string;
  registeredAt: number;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceHandle>();

  register(handle: ServiceHandle): void {
    if (this.services.has(handle.name)) {
      throw new Error(`ServiceRegistry: service "${handle.name}" is already registered`);
    }
    this.services.set(handle.name, handle);
  }

  unregister(name: string): boolean {
    return this.services.delete(name);
  }

  resolve(name: string): ServiceHandle | undefined {
    return this.services.get(name);
  }

  list(): ServiceHandle[] {
    return Array.from(this.services.values());
  }
}
