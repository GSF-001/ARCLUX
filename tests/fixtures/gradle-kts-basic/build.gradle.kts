// Fixture for tests/manifest.test.ts — Kotlin DSL (build.gradle.kts).
// Registered under a second filename by parseGradle_ (issue #436): the
// dependency syntax is the same group:artifact:version triple as Groovy.
plugins {
    id("java")
}

dependencies {
    implementation("org.springframework:spring-core:6.1.0")
    testImplementation("junit:junit:4.13.2")
}
