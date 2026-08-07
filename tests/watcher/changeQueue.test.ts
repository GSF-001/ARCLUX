// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createChangeQueue } from "../../packages/watcher/changeQueue"

describe("createChangeQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not flush before the debounce window elapses", () => {
    const onFlush = vi.fn()
    const queue = createChangeQueue(onFlush, { debounceMs: 300 })

    queue.push({ kind: "change", absolutePath: "/a.ts" })
    vi.advanceTimersByTime(299)

    expect(onFlush).not.toHaveBeenCalled()
  })

  it("flushes once after the debounce window elapses", () => {
    const onFlush = vi.fn()
    const queue = createChangeQueue(onFlush, { debounceMs: 300 })

    queue.push({ kind: "change", absolutePath: "/a.ts" })
    vi.advanceTimersByTime(300)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([{ kind: "change", absolutePath: "/a.ts" }])
  })

  it("resets the timer on every new event, delaying flush until things go quiet", () => {
    const onFlush = vi.fn()
    const queue = createChangeQueue(onFlush, { debounceMs: 300 })

    queue.push({ kind: "change", absolutePath: "/a.ts" })
    vi.advanceTimersByTime(200)
    queue.push({ kind: "change", absolutePath: "/b.ts" })
    vi.advanceTimersByTime(200)

    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([
      { kind: "change", absolutePath: "/a.ts" },
      { kind: "change", absolutePath: "/b.ts" },
    ])
  })

  it("dedupes by absolutePath, keeping only the LAST event kind for that path", () => {
    const onFlush = vi.fn()
    const queue = createChangeQueue(onFlush, { debounceMs: 300 })

    queue.push({ kind: "change", absolutePath: "/a.ts" })
    queue.push({ kind: "unlink", absolutePath: "/a.ts" })
    vi.advanceTimersByTime(300)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([{ kind: "unlink", absolutePath: "/a.ts" }])
  })

  it("does not flush anything after close() is called before the timer fires", () => {
    const onFlush = vi.fn()
    const queue = createChangeQueue(onFlush, { debounceMs: 300 })

    queue.push({ kind: "change", absolutePath: "/a.ts" })
    queue.close()
    vi.advanceTimersByTime(300)

    expect(onFlush).not.toHaveBeenCalled()
  })
})
