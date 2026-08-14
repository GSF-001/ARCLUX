// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unit tests for the packages/search engine (issue #9): SearchIndex,
// SearchEngine, SearchFilters, SearchProvider, SearchResults,
// SearchKeyboard. Fixture pattern mirrors tests/core-detectors.test.ts
// (makeRepository / makeModule with fake ModuleInfo).

import { describe, it, expect } from "vitest";
import { Repository } from "../packages/repository/Repository";
import { buildSearchIndex } from "../packages/search/SearchIndex";
import { search } from "../packages/search/SearchEngine";
import { applyFilters } from "../packages/search/SearchFilters";
import { createSearchSession } from "../packages/search/SearchProvider";
import { groupByFolder, flatten } from "../packages/search/SearchResults";
import { matchesShortcut, SEARCH_SHORTCUTS } from "../packages/search/SearchKeyboard";
import type { FileInfo, ModuleInfo, RawExport, RepositoryMeta, SupportedLanguage } from "../packages/shared/types";

function makeFile(relativePath: string, language: SupportedLanguage = "typescript", extension = ".ts"): FileInfo {
  return {
    absolutePath: `/virtual/repo/${relativePath}`,
    relativePath,
    language,
    extension,
    sizeBytes: 100,
    hash: "fake-hash",
  };
}

function named(name: string, line = 1): RawExport {
  return { name, kind: "named", line };
}

function defaultExport(name: string, line = 1): RawExport {
  return { name, kind: "default", line };
}

function makeModule(
  relativePath: string,
  opts: { language?: SupportedLanguage; extension?: string; exports?: RawExport[] } = {}
): ModuleInfo {
  return {
    id: relativePath,
    file: makeFile(relativePath, opts.language ?? "typescript", opts.extension ?? ".ts"),
    exports: opts.exports ?? [],
    resolvedReExports: {},
    importedBy: [],
    imports: [],
    resolvedImports: [],
    implicitDependencies: [],
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

describe("buildSearchIndex", () => {
  it("indexes each module with path, file name, language, and export names", () => {
    const repo = makeRepository([
      makeModule("src/engine/pipeline.ts", { exports: [named("analyzeRepository"), named("parseOrgAndName")] }),
      makeModule("src/ui/Button.tsx", { language: "typescript", extension: ".tsx", exports: [defaultExport("Button")] }),
    ]);

    const index = buildSearchIndex(repo);

    expect(index.repositoryId).toBe("test-repo");
    expect(index.entryCount).toBe(2);
    const pipeline = index.entries.find((e) => e.moduleId === "src/engine/pipeline.ts");
    expect(pipeline?.filePath).toBe("src/engine/pipeline.ts");
    expect(pipeline?.fileName).toBe("pipeline.ts");
    expect(pipeline?.language).toBe("typescript");
    expect(pipeline?.exports).toEqual(["analyzeRepository", "parseOrgAndName"]);
    const button = index.entries.find((e) => e.moduleId === "src/ui/Button.tsx");
    expect(button?.fileName).toBe("Button.tsx");
    expect(button?.exports).toEqual(["Button"]);
  });

  it("deduplicates repeated export names", () => {
    const index = buildSearchIndex(
      makeRepository([makeModule("src/dup.ts", { exports: [named("foo"), named("foo")] })])
    );
    expect(index.entries[0].exports).toEqual(["foo"]);
  });

  it("produces an empty index for an empty repository", () => {
    const index = buildSearchIndex(makeRepository([]));
    expect(index.entries).toEqual([]);
    expect(index.entryCount).toBe(0);
  });
});

describe("search", () => {
  it("ranks an exact path match above a partial one", () => {
    const index = buildSearchIndex(
      makeRepository([makeModule("src/alpha/foo.ts"), makeModule("src/alpha/fooBar.ts")])
    );

    const results = search(index, "src/alpha/foo.ts");

    expect(results).toHaveLength(2);
    expect(results[0].moduleId).toBe("src/alpha/foo.ts");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("finds modules by export name (alias matching)", () => {
    const index = buildSearchIndex(
      makeRepository([
        makeModule("src/core/parser.ts", { exports: [named("parseTokenStream")] }),
        makeModule("src/core/tokenizer.ts"),
      ])
    );

    const results = search(index, "parseTokenStream");

    expect(results).toHaveLength(1);
    expect(results[0].moduleId).toBe("src/core/parser.ts");
    expect(results[0].matches?.includes("parseTokenStream")).toBe(true);
  });

  it("finds modules by file name", () => {
    const index = buildSearchIndex(
      makeRepository([makeModule("src/deep/nested/helpers.ts"), makeModule("src/other.ts")])
    );

    const results = search(index, "helpers");

    expect(results[0].moduleId).toBe("src/deep/nested/helpers.ts");
    expect(results[0].matches?.includes("fileName")).toBe(true);
  });

  it("caps results at the default limit and respects an explicit limit", () => {
    const modules = Array.from({ length: 60 }, (_, i) => makeModule(`src/module-${String(i).padStart(2, "0")}.ts`));
    const index = buildSearchIndex(makeRepository(modules));

    expect(search(index, "module")).toHaveLength(50);
    expect(search(index, "module", { limit: 5 })).toHaveLength(5);
    expect(search(index, "module", { limit: 100 })).toHaveLength(60);
  });

  it("returns [] for an empty index, an empty query, or no matches", () => {
    const empty = buildSearchIndex(makeRepository([]));
    expect(search(empty, "anything")).toEqual([]);

    const populated = buildSearchIndex(makeRepository([makeModule("src/a.ts")]));
    expect(search(populated, "   ")).toEqual([]);
    expect(search(populated, "zzzz-nothing-matches")).toEqual([]);
  });

  it("sorts ties deterministically (shorter path first, then lexicographic)", () => {
    const index = buildSearchIndex(
      makeRepository([
        makeModule("src/zzz/deep/path/aaa/util.ts"),
        makeModule("src/aaa/util.ts"),
      ])
    );

    const results = search(index, "util");

    expect(results[0].filePath).toBe("src/aaa/util.ts");
    expect(results[1].filePath).toBe("src/zzz/deep/path/aaa/util.ts");
  });
});

describe("applyFilters", () => {
  it("narrows results by language", () => {
    const index = buildSearchIndex(
      makeRepository([
        makeModule("src/py/main.py", { language: "python", extension: ".py" }),
        makeModule("src/ts/main.ts"),
      ])
    );

    const results = search(index, "main");
    expect(results).toHaveLength(2);

    const pythonOnly = applyFilters(results, { language: "python" });
    expect(pythonOnly).toHaveLength(1);
    expect(pythonOnly[0].filePath).toBe("src/py/main.py");
  });

  it("narrows results by folder prefix without leaking across sibling folders", () => {
    const index = buildSearchIndex(
      makeRepository([
        makeModule("src/components/Button.tsx"),
        makeModule("src/componentsx/Other.tsx"),
        makeModule("src/utils/helper.ts"),
      ])
    );

    const results = search(index, "src");
    expect(results).toHaveLength(3);

    const inComponents = applyFilters(results, { folderPrefix: "src/components" });
    expect(inComponents.map((r) => r.filePath)).toEqual(["src/components/Button.tsx"]);

    const underSrc = applyFilters(results, { folderPrefix: "src" });
    expect(underSrc).toHaveLength(3);
  });

  it("filters by minScore, keeping the top-ranked result", () => {
    const index = buildSearchIndex(
      makeRepository([makeModule("src/alpha/foo.ts"), makeModule("src/alpha/fooBar.ts")])
    );

    const results = search(index, "src/alpha/foo.ts");
    const topScore = results[0].score;
    expect(topScore).toBeGreaterThan(results[1].score);

    const aboveFloor = applyFilters(results, { minScore: topScore });
    expect(aboveFloor.map((r) => r.filePath)).toEqual(["src/alpha/foo.ts"]);
  });

  it("returns results unchanged when no filters are given", () => {
    const index = buildSearchIndex(makeRepository([makeModule("src/a.ts")]));
    const results = search(index, "a");
    expect(applyFilters(results)).toBe(results);
  });
});

describe("createSearchSession", () => {
  it("returns [] before a repository is set and serves queries afterwards", () => {
    const session = createSearchSession();
    expect(session.index).toBeNull();
    expect(session.query("anything")).toEqual([]);

    session.setRepository(makeRepository([makeModule("src/a.ts")]));
    expect(session.index?.entryCount).toBe(1);
    expect(session.query("a.ts")).toHaveLength(1);
  });

  it("applies filters passed to query", () => {
    const session = createSearchSession();
    session.setRepository(
      makeRepository([
        makeModule("src/py/main.py", { language: "python", extension: ".py" }),
        makeModule("src/ts/main.ts"),
      ])
    );

    const filtered = session.query("main", { language: "python" });
    expect(filtered.map((r) => r.filePath)).toEqual(["src/py/main.py"]);
  });
});

describe("groupByFolder / flatten", () => {
  it("groups results by containing folder and flattens back in order", () => {
    const index = buildSearchIndex(
      makeRepository([
        makeModule("src/components/Button.tsx"),
        makeModule("src/utils/helper.ts"),
        makeModule("root.ts"),
      ])
    );

    const results = search(index, "ts");
    expect(results).toHaveLength(3);

    const groups = groupByFolder(results);
    expect(groups["src/components"].map((r) => r.filePath)).toEqual(["src/components/Button.tsx"]);
    expect(groups["src/utils"].map((r) => r.filePath)).toEqual(["src/utils/helper.ts"]);
    expect(groups[""].map((r) => r.filePath)).toEqual(["root.ts"]);

    expect(flatten(groups)).toEqual(results);
  });
});

describe("matchesShortcut", () => {
  function event(partial: Partial<KeyboardEvent>): KeyboardEvent {
    return {
      key: "",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      ...partial,
    } as KeyboardEvent;
  }

  it("matches mod+k with ctrl or meta held, but not bare k", () => {
    expect(matchesShortcut(event({ key: "k", ctrlKey: true }), SEARCH_SHORTCUTS.openSearch)).toBe(true);
    expect(matchesShortcut(event({ key: "k", metaKey: true }), SEARCH_SHORTCUTS.openSearch)).toBe(true);
    expect(matchesShortcut(event({ key: "k" }), SEARCH_SHORTCUTS.openSearch)).toBe(false);
  });

  it("matches a plain key only when no hard modifier is held", () => {
    expect(matchesShortcut(event({ key: "Escape" }), SEARCH_SHORTCUTS.closeSearch)).toBe(true);
    expect(matchesShortcut(event({ key: "Escape", ctrlKey: true }), SEARCH_SHORTCUTS.closeSearch)).toBe(false);
  });

  it("matches any of several specs", () => {
    expect(matchesShortcut(event({ key: "/" }), ["Escape", "/"])).toBe(true);
    expect(matchesShortcut(event({ key: "x" }), ["Escape", "/"])).toBe(false);
  });
});
