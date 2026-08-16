// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

export interface MockRequest {
  target: string;
  inputVariant: string;
}

export interface MockResponse {
  status: 200 | 400 | 404;
  body: "accepted" | "rejected" | "not-found";
}

/** A deterministic, in-memory target. It never opens a socket or executes input. */
export function mockTarget(request: MockRequest): MockResponse {
  if (!request.target.startsWith("mock://")) return { status: 404, body: "not-found" };
  if (request.inputVariant === "baseline") return { status: 200, body: "accepted" };
  return { status: 400, body: "rejected" };
}
