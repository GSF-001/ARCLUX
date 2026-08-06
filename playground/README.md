# playground/

Hand-written fixture repos used to verify the pipeline end-to-end against
real (if small) code, via `scripts/testPlayground.ts <fixture-name>` -
not unit tests, but "does this actually work on real-ish code" checks.
See root PROGRES.md for specific verification runs already done against
these.

Run any fixture:

    npx tsx scripts/testPlayground.ts <fixture-name>

## The pattern every fixture follows

Every fixture ships a `cyclicA` / `cyclicB` pair (naming varies by
language convention: `cyclic_a.py`, `CyclicA.java`, `cyclicA.ts`, etc.)
that calls into each other, specifically to exercise
`detectCircularDependency`. Beyond that shared pair, each fixture adds
its own language/framework-specific files to test other detectors
(unused exports, orphan files, framework convention rules).

If you add a new fixture, keep this pattern: include a cyclic pair, and
leave at least one deliberately-unused export so
`detectUnusedExports`/`detectUnusedFiles` have something to catch.

## Fixtures

| Fixture | Tests | Parser/rules status | Notes |
|---|---|---|---|
| `go-demo` | Go parser, detectCircularDependency, detectUnusedExports | parser: working | Verified: 6/6 modules indexed, exports correctly extracted via uppercase-letter convention including deliberately-unused `UnusedHelper`. Graph shows 0 edges - Go doesn't require imports between files in the same package, known limitation, not a parser bug. See root PROGRES.md. |
| `java-demo` | Java parser, detectCircularDependency, detectUnusedExports | parser: working | Verified: 6/6 modules indexed, `public`-modifier exports correctly extracted including deliberately-unused `unusedHelper`. Same same-package-no-import limitation as go-demo - 0 graph edges is expected, not a bug. |
| `python-demo` | Python parser (tree-sitter), detectCircularDependency, detectUnusedExports | parser: working | Uses web-tree-sitter + WASM grammar, not regex - see PROGRES.md gotchas for why this was non-trivial on Termux/Webpack. |
| `express-demo` | TS/JS parser, Express convention rules | parser: working, rules: stub | `packages/rules/express/` is a stub per packages/README.md, so this fixture's routing-convention checks (userController, productController wiring) can't be verified against rules yet - only generic detectors run on it today. |
| `nest-demo` | TS parser, NestJS convention rules | parser: working, rules: stub | Same situation as express-demo - `packages/rules/nestjs/` is stub. app.module/controller/service wiring can't be checked for convention violations yet, only generic detectors apply. |
| `nextjs-demo` | TSX parser, Next.js convention rules | parser: working, rules: stub | `packages/rules/nextjs/` is stub. Page/component files here (page.tsx, Header.tsx, Footer.tsx) are meant to test route-registration conventions once that rule exists - not yet exercised. |
| `react-demo` | TSX parser, React convention rules | parser: working, rules: stub | `packages/rules/react/` is stub. App/Button/Card component structure here is meant to test hook-rules/component-export conventions once that rule exists. |

## What's NOT covered here

No fixtures exist yet for Rust, C#, PHP, Ruby, or C++ source parsing -
matches the 6 remaining stub parsers noted in `packages/README.md`
(manifest parsers for these languages - go.mod, Cargo.toml, composer.json,
Gemfile, pom.xml/build.gradle - ARE done and were verified separately
against real downloaded manifests, see root PROGRES.md; this playground/
only covers source-code parsing, not manifests).

Electron and Vite convention rules (`packages/rules/electron`,
`packages/rules/vite`) also have no fixture yet - both are stub per
packages/README.md.
