# playground/

Small hand-written fixture repos, one per language/framework ARCLUX
supports, used to sanity-check the pipeline against real-ish code:

    npx tsx scripts/testPlayground.ts go-demo
    npx tsx scripts/testPlayground.ts python-demo
    npx tsx scripts/testPlayground.ts react-demo

This runs the full buildIndex -> buildDependencyGraph -> all 16
detectors pipeline against the fixture and prints what it finds — a fast
way to check "does this actually work" without cloning a real repo.

## Fixtures


| Fixture | Language / framework |
|---|---|
| go-demo | Go |
| java-demo | Java |
| python-demo | Python |
| react-demo | React (component conventions) |
| nextjs-demo | Next.js (routing conventions) |
| express-demo | Express (route registration) |
| nest-demo | NestJS (module/controller wiring) |

## The shared pattern

Every fixture includes a cyclicA / cyclicB pair that calls into each
other — this exists purely to give detectCircularDependency something
to find. Most fixtures also include at least one deliberately unused
export, so detectUnusedExports has something to flag.

If you're adding a new fixture (say, for a language ARCLUX doesn't
support yet), follow the same pattern: a small set of files with one
genuine circular reference and one genuinely dead export, so the
detectors have real signal to test against — not just files that happen
to parse.

----
| Fixture | Tests | Parser/rules status | Notes |
|---|---|---|---|
| go-demo | Go parser, detectCircularDependency, detectUnusedExports | parser: working | Verified: 6/6 modules indexed, exports correctly extracted via uppercase-letter convention including deliberately-unused UnusedHelper. |
| java-demo | Java parser, detectCircularDependency, detectUnusedExports | parser: working | Verified: 6/6 modules indexed, public-modifier exports correctly extracted including deliberately-unused unusedHelper. |
| python-demo | Python parser (tree-sitter), detectCircularDependency, detectUnusedExports | parser: working | Uses web-tree-sitter + WASM grammar, not regex - see PROGRES.md gotchas for why this was non-trivial on Termux/Webpack. |
| express-demo | TS/JS parser, Express convention rules | parser: working, rules: stub | packages/rules/express/ is a stub per packages/README.md. |
| nest-demo | TS parser, NestJS convention rules | parser: working, rules: stub | packages/rules/nestjs/ is stub. |
| nextjs-demo | TSX parser, Next.js convention rules | parser: working, rules: stub | packages/rules/nextjs/ is stub. |
| react-demo | TSX parser, React convention rules | parser: working, rules: stub | packages/rules/react/ is stub. |

## What's NOT covered here

No fixtures exist yet for Rust, C#, PHP, Ruby, or C++ source parsing.
Electron and Vite convention rules also have no fixture yet.
main
