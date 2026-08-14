// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for issue #353: packages/notifications/ subscribes to the daemon's
// diagnostic events and fans them out to registered channels instead of
// callers subscribing to signalBus event names directly.

import { describe, it, expect, vi } from "vitest";
import { SignalBus } from "../packages/kernel/SignalBus";
import { NotificationManager, toNotifications } from "../packages/notifications/NotificationManager";
import type { Notification } from "../packages/notifications/Notification";
import type { NotificationChannel } from "../packages/notifications/NotificationChannel";
import { ArcluxDaemon } from "../packages/daemon/ArcluxDaemon";
import type { DiagnosticFinding } from "../packages/diagnostics/DiagnosticEngine";

function makeFinding(overrides: Partial<DiagnosticFinding> = {}): DiagnosticFinding {
  return {
    checkId: "deadCode",
    severity: "warning" as const,
    message: "unused export",
    locations: [{ moduleId: "m1", filePath: "src/a.ts", line: 3, locationPrecision: "line" }],
    ...overrides,
  };
}

function collectingChannel(id: string): NotificationChannel & { received: Notification[] } {
  const received: Notification[] = [];
  return {
    id,
    received,
    deliver: (n: Notification) => {
      received.push(n);
    },
  };
}

describe("toNotifications (issue #353 normalization)", () => {
  it("maps each finding to a notification with location info", () => {
    const notifications = toNotifications({
      findings: [makeFinding()],
      at: 123,
    });

    expect(notifications).toEqual([
      {
        id: "deadCode:m1:3",
        severity: "warning",
        message: "unused export",
        at: 123,
        source: "deadCode",
        filePath: "src/a.ts",
        line: 3,
      },
    ]);
  });

  it("handles findings without locations (file-level fallback)", () => {
    const notifications = toNotifications({
      findings: [makeFinding({ locations: [] })],
      at: 1,
    });

    expect(notifications[0]).toMatchObject({
      id: "deadCode:?:0",
      filePath: null,
      line: null,
    });
  });

  it("maps error severity and tolerates missing message", () => {
    const notifications = toNotifications({
      findings: [makeFinding({ severity: "error", message: "" })],
      at: 1,
    });

    expect(notifications[0]).toMatchObject({ severity: "error", message: "deadCode" });
  });
});

describe("NotificationManager (issue #353 fan-out)", () => {
  it("delivers daemon:diagnostics:updated events to all registered channels", () => {
    const bus = new SignalBus();
    const manager = new NotificationManager(bus);
    const a = collectingChannel("a");
    const b = collectingChannel("b");
    manager.registerChannel(a);
    manager.registerChannel(b);
    manager.start();

    bus.emit("daemon:diagnostics:updated", { findings: [makeFinding()], at: 5 });

    expect(a.received).toHaveLength(1);
    expect(b.received).toHaveLength(1);
    expect(a.received[0]).toMatchObject({ source: "deadCode", filePath: "src/a.ts", line: 3, at: 5 });
    manager.stop();
  });

  it("start() is idempotent — double start does not double-deliver", () => {
    const bus = new SignalBus();
    const manager = new NotificationManager(bus);
    const channel = collectingChannel("c");
    manager.registerChannel(channel);
    manager.start();
    manager.start();

    bus.emit("daemon:diagnostics:updated", { findings: [makeFinding()], at: 1 });

    expect(channel.received).toHaveLength(1);
    manager.stop();
  });

  it("stop() unsubscribes — later events are not delivered", () => {
    const bus = new SignalBus();
    const manager = new NotificationManager(bus);
    const channel = collectingChannel("c");
    manager.registerChannel(channel);
    manager.start();
    manager.stop();

    bus.emit("daemon:diagnostics:updated", { findings: [makeFinding()], at: 1 });

    expect(channel.received).toHaveLength(0);
  });

  it("unregisterChannel removes a channel from the fan-out", () => {
    const bus = new SignalBus();
    const manager = new NotificationManager(bus);
    const a = collectingChannel("a");
    manager.registerChannel(a);
    manager.start();
    expect(manager.unregisterChannel("a")).toBe(true);
    expect(manager.hasChannel("a")).toBe(false);

    bus.emit("daemon:diagnostics:updated", { findings: [makeFinding()], at: 1 });

    expect(a.received).toHaveLength(0);
    manager.stop();
  });

  it("a throwing channel does not starve the other channels", () => {
    const bus = new SignalBus();
    const manager = new NotificationManager(bus);
    const throwing: NotificationChannel = {
      id: "thrower",
      deliver: () => {
        throw new Error("channel broke");
      },
    };
    const ok = collectingChannel("ok");
    manager.registerChannel(throwing);
    manager.registerChannel(ok);
    manager.start();

    expect(() => bus.emit("daemon:diagnostics:updated", { findings: [makeFinding()], at: 1 })).not.toThrow();
    expect(ok.received).toHaveLength(1);
    manager.stop();
  });

  it("empty findings produce no notifications and no channel calls", () => {
    const bus = new SignalBus();
    const manager = new NotificationManager(bus);
    const channel = collectingChannel("c");
    const deliverSpy = vi.spyOn(channel, "deliver");
    manager.registerChannel(channel);
    manager.start();

    bus.emit("daemon:diagnostics:updated", { findings: [], at: 1 });

    expect(deliverSpy).not.toHaveBeenCalled();
    manager.stop();
  });
});

describe("ArcluxDaemon wiring (issue #353)", () => {
  it("registers notificationChannels option onto daemon.notifications", () => {
    const channel = collectingChannel("console");
    const daemon = new ArcluxDaemon({ rootPath: ".", notificationChannels: [channel] });

    expect(daemon.notifications.hasChannel("console")).toBe(true);
  });

  it("daemon.notifications shares the daemon's signalBus (event flows end-to-end)", () => {
    const channel = collectingChannel("console");
    const daemon = new ArcluxDaemon({ rootPath: ".", notificationChannels: [channel] });
    daemon.notifications.start();

    daemon.kernel.signalBus.emit("daemon:diagnostics:updated", { findings: [makeFinding()], at: 7 });

    expect(channel.received).toHaveLength(1);
    expect(channel.received[0]).toMatchObject({ at: 7, severity: "warning" });
    daemon.notifications.stop();
  });
});
