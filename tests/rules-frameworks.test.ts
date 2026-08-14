// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tests for the 10 framework rules implemented in this round (nextjs x4,
// nestjs x2, express, vite, electron x2). Hand-built Repositories, same
// style as tests/rules.test.ts. react/requirePropsTyping stays untested
// because it is a documented deferral, not an implementation.

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { runRules } from "../packages/rules/RuleEngine";
import { requireRoute } from "../packages/rules/nextjs/requireRoute";
import { requireIndexUpdate } from "../packages/rules/nextjs/requireIndexUpdate";
import { requireLayoutUpdate } from "../packages/rules/nextjs/requireLayoutUpdate";
import { requireMetadata } from "../packages/rules/nextjs/requireMetadata";
import { requireControllerBinding } from "../packages/rules/nestjs/requireControllerBinding";
import { requireModuleRegistration } from "../packages/rules/nestjs/requireModuleRegistration";
import { requireRouteRegistration } from "../packages/rules/express/requireRouteRegistration";
import { requireEntryConfig } from "../packages/rules/vite/requireEntryConfig";
import { requireMainProcessBinding } from "../packages/rules/electron/requireMainProcessBinding";
import { requirePreloadExposure } from "../packages/rules/electron/requirePreloadExposure";
import type { ModuleInfo, RepositoryMeta, FileInfo, RawExport } from "../packages/shared/types";

function makeFile(relativePath: string): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language: "typescript",
    extension: relativePath.endsWith(".tsx") ? ".tsx" : ".ts",
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

function named(name: string, line = 1): RawExport {
  return { name, kind: "named", line };
}

function reExport(name: string, source: string, line = 1): RawExport {
  return { name, kind: "re-export", reExportSource: source, line };
}

function makeModule(
  relativePath: string,
  exports: RawExport[] = [],
  overrides: Partial<ModuleInfo> = {}
): ModuleInfo {
  return {
    id: relativePath,
    file: makeFile(relativePath),
    exports,
    resolvedReExports: {},
    importedBy: [],
    imports: [],
    resolvedImports: [],
    calls: [],
    calledBy: [],
    implicitDependencies: [],
    ...overrides,
  };
}

function makeRepository(modules: ModuleInfo[]): Repository {
  const meta: RepositoryMeta = {
    id: "test-repo",
    org: "test-org",
    name: "test-repo",
    defaultBranch: "main",
    rootPath: "/virtual/repo",
    detectedFrameworks: [],
    packageManager: "npm",
    analyzedAt: new Date().toISOString(),
  };
  const repository = new Repository(meta);
  for (const mod of modules) {
    repository.addModule(mod);
  }
  return repository;
}

describe("nextjs/requireRoute", () => {
  it("flags a route handler that exports no HTTP method", () => {
    const repo = makeRepository([
      makeModule("app/api/impact/route.ts", [named("runtime")]),
      makeModule("app/api/search/route.ts", []),
    ]);
    const violations = runRules(repo, [requireRoute], ["nextjs"]);
    expect(violations).toHaveLength(2);
    expect(violations.every((v) => v.ruleId === "nextjs/require-route")).toBe(true);
    expect(violations[0].filePath).toBe("app/api/impact/route.ts");
  });

  it("passes a route handler exporting an HTTP method (named export)", () => {
    const repo = makeRepository([
      makeModule("app/api/users/route.ts", [named("GET"), named("POST")]),
    ]);
    expect(runRules(repo, [requireRoute], ["nextjs"])).toHaveLength(0);
  });

  it("passes a route handler that re-exports an HTTP method", () => {
    const repo = makeRepository([
      makeModule("app/api/users/route.ts", [reExport("GET", "./handlers.ts")]),
    ]);
    expect(runRules(repo, [requireRoute], ["nextjs"])).toHaveLength(0);
  });

  it("ignores route files outside app/ and non-route files inside app/", () => {
    const repo = makeRepository([
      makeModule("lib/route.ts", []), // not under app/
      makeModule("app/page.tsx", []), // page, not a route handler
    ]);
    expect(runRules(repo, [requireRoute], ["nextjs"])).toHaveLength(0);
  });

  it("does not run when the framework is not detected", () => {
    const repo = makeRepository([makeModule("app/api/x/route.ts", [])]);
    expect(runRules(repo, [requireRoute], ["react"])).toHaveLength(0);
  });
});

describe("express/requireRouteRegistration", () => {
  it("flags a routes/ module that nothing imports", () => {
    const repo = makeRepository([makeModule("routes/users.ts", [named("router")])]);
    const violations = runRules(repo, [requireRouteRegistration], ["express"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("routes/users.ts");
    expect(violations[0].severity).toBe("warning");
  });

  it("passes a routes/ module that the app wiring imports", () => {
    const repo = makeRepository([
      makeModule("routes/users.ts", [named("router")], { importedBy: ["server.ts"] }),
    ]);
    expect(runRules(repo, [requireRouteRegistration], ["express"])).toHaveLength(0);
  });

  it("flags a *.router.* file with no importers", () => {
    const repo = makeRepository([makeModule("src/auth.router.ts", [named("authRouter")])]);
    expect(runRules(repo, [requireRouteRegistration], ["express"])).toHaveLength(1);
  });

  it("flags a module exporting a symbol named router even outside routes/", () => {
    const repo = makeRepository([makeModule("src/orders.ts", [named("router")])]);
    expect(runRules(repo, [requireRouteRegistration], ["express"])).toHaveLength(1);
  });

  it("ignores ordinary modules with no importers", () => {
    const repo = makeRepository([makeModule("src/util.ts", [named("helper")])]);
    expect(runRules(repo, [requireRouteRegistration], ["express"])).toHaveLength(0);
  });
});

describe("nextjs/requireIndexUpdate", () => {
  it("flags a sibling module not re-exported by the folder barrel", () => {
    const repo = makeRepository([
      makeModule("src/components/index.ts", [reExport("Button", "./Button.tsx")], {
        resolvedReExports: { Button: "src/components/Button.tsx" },
      }),
      makeModule("src/components/Button.tsx", [named("Button")]),
      makeModule("src/components/Card.tsx", [named("Card")]),
    ]);
    const violations = runRules(repo, [requireIndexUpdate], ["nextjs"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("src/components/index.ts");
    expect(violations[0].message).toContain("Card.tsx");
  });

  it("passes when the barrel re-exports every exporting sibling", () => {
    const repo = makeRepository([
      makeModule("src/components/index.ts", [reExport("*", "./Button.tsx")], {
        resolvedReExports: { "*": "src/components/Button.tsx" },
      }),
      makeModule("src/components/Button.tsx", [named("Button")]),
    ]);
    expect(runRules(repo, [requireIndexUpdate], ["nextjs"])).toHaveLength(0);
  });

  it("ignores siblings with no exports and test files", () => {
    const repo = makeRepository([
      makeModule("src/components/index.ts", [], { resolvedReExports: { Button: "src/components/Button.tsx" } }),
      makeModule("src/components/Button.tsx", [named("Button")]),
      makeModule("src/components/theme.css.d.ts", []), // nothing exported
      makeModule("src/components/Button.test.tsx", [named("renderButton")]), // test file
    ]);
    expect(runRules(repo, [requireIndexUpdate], ["nextjs"])).toHaveLength(0);
  });

  it("ignores an index.ts that is not a barrel (no resolved re-exports)", () => {
    const repo = makeRepository([
      makeModule("src/components/index.ts", [named("localHelper")]),
      makeModule("src/components/Button.tsx", [named("Button")]),
    ]);
    expect(runRules(repo, [requireIndexUpdate], ["nextjs"])).toHaveLength(0);
  });
});

describe("nextjs/requireLayoutUpdate", () => {
  it("errors when app/ exists but there is no root layout", () => {
    const repo = makeRepository([
      makeModule("app/dashboard/layout.tsx", [named("DashboardLayout")]),
      makeModule("app/dashboard/page.tsx", [named("Dashboard")]),
    ]);
    const violations = runRules(repo, [requireLayoutUpdate], ["nextjs"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe("error");
    expect(violations[0].filePath).toBe("app/layout.tsx");
  });

  it("passes when app/layout.tsx exists", () => {
    const repo = makeRepository([
      makeModule("app/layout.tsx", [named("RootLayout")]),
      makeModule("app/page.tsx", [named("Home")]),
    ]);
    expect(runRules(repo, [requireLayoutUpdate], ["nextjs"])).toHaveLength(0);
  });

  it("ignores repositories with no app/ directory", () => {
    const repo = makeRepository([makeModule("src/App.tsx", [named("App")])]);
    expect(runRules(repo, [requireLayoutUpdate], ["nextjs"])).toHaveLength(0);
  });
});

describe("nextjs/requireMetadata", () => {
  it("flags a page exporting neither metadata nor generateMetadata", () => {
    const repo = makeRepository([makeModule("app/about/page.tsx", [named("About")])]);
    const violations = runRules(repo, [requireMetadata], ["nextjs"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("app/about/page.tsx");
  });

  it("passes a page exporting static metadata", () => {
    const repo = makeRepository([
      makeModule("app/about/page.tsx", [named("About"), named("metadata")]),
    ]);
    expect(runRules(repo, [requireMetadata], ["nextjs"])).toHaveLength(0);
  });

  it("passes a page exporting generateMetadata", () => {
    const repo = makeRepository([
      makeModule("app/users/[id]/page.tsx", [named("generateMetadata"), named("UserPage")]),
    ]);
    expect(runRules(repo, [requireMetadata], ["nextjs"])).toHaveLength(0);
  });

  it("ignores non-page files", () => {
    const repo = makeRepository([makeModule("app/layout.tsx", [named("RootLayout")])]);
    expect(runRules(repo, [requireMetadata], ["nextjs"])).toHaveLength(0);
  });
});

describe("nestjs/requireControllerBinding", () => {
  it("flags a controller not imported by any module file", () => {
    const repo = makeRepository([makeModule("src/users/users.controller.ts", [named("UsersController")])]);
    const violations = runRules(repo, [requireControllerBinding], ["nestjs"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("src/users/users.controller.ts");
  });

  it("passes a controller imported by a module file", () => {
    const repo = makeRepository([
      makeModule("src/users/users.controller.ts", [named("UsersController")], {
        importedBy: ["src/users/users.module.ts"],
      }),
    ]);
    expect(runRules(repo, [requireControllerBinding], ["nestjs"])).toHaveLength(0);
  });

  it("ignores service files", () => {
    const repo = makeRepository([makeModule("src/users/users.service.ts", [named("UsersService")])]);
    expect(runRules(repo, [requireControllerBinding], ["nestjs"])).toHaveLength(0);
  });
});

describe("nestjs/requireModuleRegistration", () => {
  const root = makeModule("src/app.module.ts", [named("AppModule")]);
  const registered = makeModule("src/users/users.module.ts", [named("UsersModule")], {
    imports: ["src/app.module.ts"],
    importedBy: ["src/app.module.ts"],
  });

  it("flags a module file not reachable from app.module.ts", () => {
    const orphan = makeModule("src/billing/billing.module.ts", [named("BillingModule")], {
      imports: [],
      importedBy: [],
    });
    const repo = makeRepository([
      { ...root, imports: ["src/users/users.module.ts"] },
      registered,
      orphan,
    ]);
    const violations = runRules(repo, [requireModuleRegistration], ["nestjs"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("src/billing/billing.module.ts");
  });

  it("passes when every module is reachable from the root", () => {
    const repo = makeRepository([
      { ...root, imports: ["src/users/users.module.ts"] },
      registered,
    ]);
    expect(runRules(repo, [requireModuleRegistration], ["nestjs"])).toHaveLength(0);
  });

  it("flags modules when there is no root app.module.ts", () => {
    const lone = makeModule("src/users/users.module.ts", [named("UsersModule")], {
      imports: [],
      importedBy: [],
    });
    const repo = makeRepository([lone]);
    const violations = runRules(repo, [requireModuleRegistration], ["nestjs"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("root app.module.ts");
  });

  it("returns no violations when no module files exist", () => {
    const repo = makeRepository([makeModule("src/main.ts", [named("bootstrap")])]);
    expect(runRules(repo, [requireModuleRegistration], ["nestjs"])).toHaveLength(0);
  });
});

describe("vite/requireEntryConfig", () => {
  it("flags both a missing vite.config and a missing entry", () => {
    const repo = makeRepository([makeModule("src/index.ts", [named("main")])]);
    const violations = runRules(repo, [requireEntryConfig], ["vite"]);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.ruleId)).toEqual(["vite/require-entry-config", "vite/require-entry-config"]);
  });

  it("passes with vite.config.ts and src/main.tsx", () => {
    const repo = makeRepository([
      makeModule("vite.config.ts", []),
      makeModule("src/main.tsx", [named("App")]),
    ]);
    expect(runRules(repo, [requireEntryConfig], ["vite"])).toHaveLength(0);
  });

  it("flags only the entry when the config exists", () => {
    const repo = makeRepository([makeModule("vite.config.ts", [])]);
    const violations = runRules(repo, [requireEntryConfig], ["vite"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("src/main");
  });
});

describe("electron/requireMainProcessBinding", () => {
  it("errors when no main-process entry exists", () => {
    const repo = makeRepository([makeModule("src/renderer.ts", [named("render")])]);
    const violations = runRules(repo, [requireMainProcessBinding], ["electron"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe("error");
  });

  it("passes with a root main.ts", () => {
    const repo = makeRepository([makeModule("main.ts", [named("createWindow")])]);
    expect(runRules(repo, [requireMainProcessBinding], ["electron"])).toHaveLength(0);
  });

  it("passes with electron/main.ts", () => {
    const repo = makeRepository([makeModule("electron/main.ts", [named("createWindow")])]);
    expect(runRules(repo, [requireMainProcessBinding], ["electron"])).toHaveLength(0);
  });
});

describe("electron/requirePreloadExposure", () => {
  it("flags a preload script that nothing imports", () => {
    const repo = makeRepository([
      makeModule("main.ts", [named("createWindow")]),
      makeModule("preload.ts", []),
    ]);
    const violations = runRules(repo, [requirePreloadExposure], ["electron"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe("preload.ts");
  });

  it("passes a preload script imported by the main process", () => {
    const repo = makeRepository([
      makeModule("preload.ts", [], { importedBy: ["main.ts"] }),
      makeModule("main.ts", [named("createWindow")]),
    ]);
    expect(runRules(repo, [requirePreloadExposure], ["electron"])).toHaveLength(0);
  });

  it("passes when no preload script exists at all", () => {
    const repo = makeRepository([makeModule("main.ts", [named("createWindow")])]);
    expect(runRules(repo, [requirePreloadExposure], ["electron"])).toHaveLength(0);
  });
});
