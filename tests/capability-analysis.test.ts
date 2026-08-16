// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

import { describe, expect, it } from "vitest";
import { assessCapabilitySource, classifyCapability } from "../packages/security-analysis/capability";

describe("capability analysis", () => {
  it("classifies behavioral evidence without executing it", () => {
    const result = assessCapabilitySource("mock://fixture", [{
      file: "fixture.ts",
      source: "const targetUrl = target; fetch(targetUrl); if (response.status) inputMutation();",
    }]);

    expect(result.capability).toBe("assessment-capability");
    expect(result.signals).toEqual(expect.arrayContaining([
      "network-io",
      "dynamic-target",
      "input-mutation",
      "response-branching",
    ]));
    expect(result.safety).toBe("mock-only");
    expect(result.mockResponses.map((response) => response.status)).toEqual([200, 400]);
  });

  it("does not infer capability from an empty source set", () => {
    const result = classifyCapability([]);
    expect(result.capability).toBe("none");
    expect(result.risk).toBe("info");
    expect(result.signals).toEqual([]);
  });

  it("does not contact non-mock targets", () => {
    const result = assessCapabilitySource("https://example.invalid", [{
      file: "fixture.ts",
      source: "fetch(target); response.status;",
    }]);
    expect(result.safety).toBe("mock-only");
    expect(result.mockResponses.every((response) => response.status === 404)).toBe(true);
  });
});
