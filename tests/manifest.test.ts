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

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { parsePom, parseGradle_ } from "../packages/parser/java/parseGradlePom";
import { analyzeRepository, type AnalyzeRepositoryResult } from "../packages/engine/pipeline";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "java-basic");

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
