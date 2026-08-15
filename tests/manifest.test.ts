// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Manifest parser tests — the FIRST tests for this package (issue #434).
// parsePom previously captured <dependency> blocks from <plugin> and
// <dependencyManagement> sections as project dependencies. Also proves the
// manifest -> analyzeRepository wiring end-to-end (status-core's "not
// wired" claim was already outdated — detectDependencies IS called by both
// analyzeLocalPath and analyzeRemoteRepository).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { parsePom, parseGradle_ } from "../packages/parser/java/parseGradlePom";
import { parseCsproj } from "../packages/parser/csharp/parseCsproj";
import { parsePackageJson } from "../packages/parser/config/parsePackageJson";
import { parseGemfile } from "../packages/parser/ruby/parseGemfile";
import { parseComposer } from "../packages/parser/php/parseComposer";
import { parseRequirements } from "../packages/parser/python/parseRequirements";
import { manifestRegistry } from "../packages/parser/core/ManifestRegistry";
import { analyzeRepository, ensureParsersRegistered, type AnalyzeRepositoryResult } from "../packages/engine/pipeline";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "java-basic");
const GRADLE_KTS_FIXTURE = path.join(__dirname, "fixtures", "gradle-kts-basic");
const CSHARP_FIXTURE = path.join(__dirname, "fixtures", "csharp-basic");

describe("parsePom", () => {
  it("extracts project dependencies with correct kinds (test scope -> dev)", () => {
    const deps = parsePom.parse(`
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.1.0</version>
    </dependency>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
`);
    expect(deps).toEqual([
      { name: "org.springframework:spring-core", versionRange: "6.1.0", kind: "runtime" },
      { name: "junit:junit", versionRange: "4.13.2", kind: "dev" },
    ]);
  });

  it("excludes <plugin> dependencies (plugin classpath, not project deps)", () => {
    const deps = parsePom.parse(`
<project>
  <dependencies>
    <dependency><groupId>a</groupId><artifactId>b</artifactId><version>1</version></dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <dependencies>
          <dependency><groupId>org.apache.maven.shared</groupId><artifactId>maven-shared-utils</artifactId></dependency>
        </dependencies>
      </plugin>
    </plugins>
  </build>
</project>
`);
    expect(deps.map((d) => d.name)).toEqual(["a:b"]);
  });

  it("excludes <dependencyManagement> entries (version management, not declared deps)", () => {
    const deps = parsePom.parse(`
<project>
  <dependencyManagement>
    <dependencies>
      <dependency><groupId>com.google.guava</groupId><artifactId>guava</artifactId><version>33.0.0-jre</version></dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency><groupId>a</groupId><artifactId>b</artifactId><version>1</version></dependency>
  </dependencies>
</project>
`);
    expect(deps.map((d) => d.name)).toEqual(["a:b"]);
  });

  it("KEEPS profile dependencies (conditional but real project deps)", () => {
    const deps = parsePom.parse(`
<project>
  <dependencies>
    <dependency><groupId>a</groupId><artifactId>b</artifactId><version>1</version></dependency>
  </dependencies>
  <profiles>
    <profile>
      <id>dev</id>
      <dependencies>
        <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><version>1.18.30</version></dependency>
      </dependencies>
    </profile>
  </profiles>
</project>
`);
    const names = deps.map((d) => d.name).sort();
    expect(names).toEqual(["a:b", "org.projectlombok:lombok"]);
  });

  it("returns [] on malformed input instead of throwing", () => {
    expect(parsePom.parse("this is not xml at all")).toEqual([]);
    expect(parsePom.parse("")).toEqual([]);
  });

  it("resolves <version>${property}</version> against the <properties> section", () => {
    const deps = parsePom.parse(`
<project>
  <properties>
    <spring.version>6.1.0</spring.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>${'${spring.version}'}</version>
    </dependency>
  </dependencies>
</project>
`);
    expect(deps[0].versionRange).toBe("6.1.0");
  });

  it("keeps unresolvable ${...} versions literal (e.g. ${project.version})", () => {
    const deps = parsePom.parse(`
<project>
  <dependencies>
    <dependency>
      <groupId>a</groupId>
      <artifactId>b</artifactId>
      <version>${'${project.version}'}</version>
    </dependency>
  </dependencies>
</project>
`);
    expect(deps[0].versionRange).toBe("${project.version}");
  });

  it("resolves chained property references iteratively", () => {
    const deps = parsePom.parse(`
<project>
  <properties>
    <base>1.0</base>
    <chain>${'${base}'}</chain>
  </properties>
  <dependencies>
    <dependency>
      <groupId>a</groupId>
      <artifactId>b</artifactId>
      <version>${'${chain}'}</version>
    </dependency>
  </dependencies>
</project>
`);
    expect(deps[0].versionRange).toBe("1.0");
  });
});

describe("parseCsproj", () => {
  it("extracts PackageReference — self-closing and open/close forms", () => {
    const deps = parseCsproj.parse(`
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageReference Include="Microsoft.Extensions.Logging" Version="8.0.0"></PackageReference>
  </ItemGroup>
</Project>
`);
    expect(deps).toEqual([
      { name: "Newtonsoft.Json", versionRange: "13.0.3", kind: "runtime" },
      { name: "Microsoft.Extensions.Logging", versionRange: "8.0.0", kind: "runtime" },
    ]);
  });

  it("matches by extension, not by an exact filename (issue #438)", () => {
    expect(parseCsproj.filename).toEqual([]);
    expect(parseCsproj.extension).toBe(".csproj");
    expect(manifestRegistry.getParserForFilename(".csproj")).toBeUndefined();
  });
});

describe("ManifestRegistry — extension-based discovery (issue #438)", () => {
  let tempDir: string;

  beforeAll(() => {
    ensureParsersRegistered();
    tempDir = mkdtempSync(path.join(os.tmpdir(), "arclux-csproj-"));
    mkdirSync(path.join(tempDir, "src", "MyApp"), { recursive: true });
    mkdirSync(path.join(tempDir, "src", "MyApp", "Tests"), { recursive: true });
    writeFileSync(
      path.join(tempDir, "src", "MyApp", "MyApp.csproj"),
      `<Project><ItemGroup><PackageReference Include="Newtonsoft.Json" Version="13.0.3" /></ItemGroup></Project>`
    );
    // Nested deeper + a distractor file to prove the walk is recursive and targeted.
    writeFileSync(
      path.join(tempDir, "src", "MyApp", "Tests", "MyApp.Tests.csproj"),
      `<Project><ItemGroup><PackageReference Include="xunit" Version="2.6.6" /></ItemGroup></Project>`
    );
    writeFileSync(path.join(tempDir, "README.md"), "# not a manifest\n");
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds nested .csproj files via the extension pass", () => {
    const names = manifestRegistry.detectDependencies(tempDir).map((d) => d.name).sort();
    expect(names).toEqual(["Newtonsoft.Json", "xunit"]);
  });
});

describe("parseGradle_", () => {
  it("extracts implementation/api/runtimeOnly as runtime, testImplementation as dev", () => {
    const deps = parseGradle_.parse(`
dependencies {
    implementation 'org.springframework:spring-core:6.1.0'
    api "com.google.guava:guava:33.0.0-jre"
    testImplementation 'junit:junit:4.13.2'
    runtimeOnly 'ch.qos.logback:logback-classic:1.4.14'
}
`);
    const summary = deps.map((d) => `${d.name}:${d.kind}`).sort();
    expect(summary).toEqual([
      "ch.qos.logback:logback-classic:runtime",
      "com.google.guava:guava:runtime",
      "junit:junit:dev",
      "org.springframework:spring-core:runtime",
    ]);
  });

  it("parses build.gradle.kts (Kotlin DSL string form) with the same syntax", () => {
    const deps = parseGradle_.parse(`
plugins {
    id("java")
}

dependencies {
    implementation("org.springframework:spring-core:6.1.0")
    testImplementation("junit:junit:4.13.2")
}
`);
    expect(deps).toEqual([
      { name: "org.springframework:spring-core", versionRange: "6.1.0", kind: "runtime" },
      { name: "junit:junit", versionRange: "4.13.2", kind: "dev" },
    ]);
  });
});

describe("ManifestRegistry — multi-filename parsers", () => {
  beforeAll(() => {
    // The singleton registry is populated lazily by the pipeline — make it
    // deterministic for this unit test.
    ensureParsersRegistered();
  });

  it("registers parseGradle_ under both build.gradle and build.gradle.kts", () => {
    const filenames = manifestRegistry.registeredFilenames;
    expect(filenames).toContain("build.gradle");
    expect(filenames).toContain("build.gradle.kts");
    expect(manifestRegistry.getParserForFilename("build.gradle.kts")).toBe(parseGradle_);
  });
});

describe("Manifest wiring e2e: pom.xml through analyzeRepository (issue #434)", () => {
  let result: AnalyzeRepositoryResult;

  beforeAll(async () => {
    result = await analyzeRepository({ localPath: FIXTURE_PATH });
  }, 30_000);

  it("surfaces only project dependencies (no plugin / dependencyManagement entries)", () => {
    const names = result.dependencies.map((d) => d.name).sort();
    expect(names).toEqual([
      "junit:junit",
      "org.projectlombok:lombok",
      "org.springframework:spring-core",
    ]);
    expect(result.dependencies.every((d) => !d.name.includes("maven-shared-utils"))).toBe(true);
    expect(result.dependencies.every((d) => !d.name.includes("guava"))).toBe(true);
  });

  it("indexes the Java source alongside the manifest", () => {
    expect(result.moduleCount).toBe(1);
    const ids = result.repository.getAllModules().map((m) => m.id);
    expect(ids).toEqual(["src/com/example/Main.java"]);
  });
});

describe("Manifest wiring e2e: build.gradle.kts through analyzeRepository", () => {
  let result: AnalyzeRepositoryResult;

  beforeAll(async () => {
    result = await analyzeRepository({ localPath: GRADLE_KTS_FIXTURE });
  }, 30_000);

  it("surfaces Kotlin DSL dependencies from build.gradle.kts", () => {
    const names = result.dependencies.map((d) => d.name).sort();
    expect(names).toEqual(["junit:junit", "org.springframework:spring-core"]);
  });
});

describe("Manifest wiring e2e: nested MyApp.csproj through analyzeRepository (issue #438)", () => {
  let result: AnalyzeRepositoryResult;

  beforeAll(async () => {
    result = await analyzeRepository({ localPath: CSHARP_FIXTURE });
  }, 30_000);

  it("surfaces NuGet PackageReference dependencies from a nested .csproj", () => {
    const names = result.dependencies.map((d) => d.name).sort();
    expect(names).toEqual([
      "Microsoft.Extensions.Logging",
      "Newtonsoft.Json",
    ]);
  });
});

describe("parsePackageJson", () => {
  it("extracts dependencies -> runtime and devDependencies -> dev", () => {
    const deps = parsePackageJson.parse(
      JSON.stringify({
        name: "app",
        dependencies: { react: "^18.2.0", lodash: "^4.17.21" },
        devDependencies: { vitest: "^1.0.0" },
      })
    );
    expect(deps).toEqual([
      { name: "react", versionRange: "^18.2.0", kind: "runtime" },
      { name: "lodash", versionRange: "^4.17.21", kind: "runtime" },
      { name: "vitest", versionRange: "^1.0.0", kind: "dev" },
    ]);
  });

  it("returns [] for malformed JSON instead of throwing", () => {
    expect(parsePackageJson.parse("not json")).toEqual([]);
  });
});

describe("parseGemfile", () => {
  it("extracts gem name + first version string and strips comments", () => {
    const deps = parseGemfile.parse(`
source "https://rubygems.org"

gem "rails", "~> 7.0"
gem "puma", "~> 6.0"
gem "nokogiri" # no version pin
# gem "commented-out", "1.0.0"
`);
    expect(deps.map((d) => d.name)).toEqual(["rails", "puma", "nokogiri"]);
    expect(deps[0]).toMatchObject({ name: "rails", versionRange: "~> 7.0", kind: "runtime" });
    expect(deps[1]).toMatchObject({ name: "puma", versionRange: "~> 6.0", kind: "runtime" });
    expect(deps[2].versionRange).toBeUndefined();
  });
});

describe("parseComposer", () => {
  it("filters platform requirements (php, ext-*) and separates require-dev", () => {
    const deps = parseComposer.parse(
      JSON.stringify({
        require: { php: "^8.1", "ext-mbstring": "*", "laravel/framework": "^10.0" },
        "require-dev": { "phpunit/phpunit": "^9.5" },
      })
    );
    expect(deps).toEqual([
      { name: "laravel/framework", versionRange: "^10.0", kind: "runtime" },
      { name: "phpunit/phpunit", versionRange: "^9.5", kind: "dev" },
    ]);
  });

  it("returns [] for malformed JSON instead of throwing", () => {
    expect(parseComposer.parse("not json")).toEqual([]);
  });
});

describe("parseRequirements", () => {
  it("keeps version operators, strips comments, env markers and option flags", () => {
    const deps = parseRequirements.parse(`
requests==2.31.0
numpy>=1.24
flask~=3.0
pydantic!=2.0
# commented
--index-url https://pypi.org/simple
-r other.txt
-e ./local
boto3; python_version < "3.8"
`);
    expect(deps.map((d) => `${d.name}:${d.versionRange ?? "none"}`)).toEqual([
      "requests:==2.31.0",
      "numpy:>=1.24",
      "flask:~=3.0",
      "pydantic:!=2.0",
      "boto3:none",
    ]);
  });
});
