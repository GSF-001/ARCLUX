# vendor-ui

Third-party and custom UI components, kept separate from `components/` so it's
always clear which code is ours to freely refactor vs. which is vendored and
should be updated deliberately (re-run the install command, not hand-edited
piecemeal).

## Structure

```
vendor-ui/
├── shadcn/       shadcn/ui primitives (button, dialog, tabs, ...)
├── aceternity/   Aceternity UI — animated/decorative components
├── magic-ui/     Magic UI — animated/decorative components
└── _inbox/       Custom one-offs, not from any vendor library
```

## Import alias

All vendor components are imported as `@/vendor-ui/<library>/<component>`, e.g.:

```ts
import { Button } from "@/vendor-ui/shadcn/button";
import { Dock } from "@/vendor-ui/magic-ui/dock";
import { Spotlight } from "@/vendor-ui/aceternity/spotlight";
import { NeonGlowCard } from "@/vendor-ui/_inbox/neon-glow-card";
```

Never import from `components/ui/*` — that path shouldn't have anything in it.
If a file ever lands there after running an install command below, it means
`components.json`'s `aliases.ui` got reset; move the file and re-check that config.

## shadcn/ui

Installed via the official CLI. `components.json` → `aliases.ui` is set to
`@/vendor-ui/shadcn`, so new components land in the right place automatically:

```bash
npx shadcn@latest add <component-name>
```

## Magic UI

No dedicated alias — installs through the same shadcn CLI machinery, which means
it currently lands in `vendor-ui/shadcn/` (following `aliases.ui`) and has to be
moved into `vendor-ui/magic-ui/` by hand afterward:

```bash
npx shadcn@latest add "https://magicui.design/r/<component-name>.json"
# then: mv vendor-ui/shadcn/<file>.tsx vendor-ui/magic-ui/
# then: fix any @/vendor-ui/shadcn/<file> imports to @/vendor-ui/magic-ui/<file>
```

## Aceternity UI

Has its own shadcn-compatible registry. Registered once in `components.json`:

```json
"registries": {
  "@aceternity": "https://ui.aceternity.com/registry/{name}.json"
}
```

Install:

```bash
npx shadcn@latest add @aceternity/<component-name>
```

Note: in practice this has landed components in `components/ui/` (ignoring
`aliases.ui`) rather than `vendor-ui/shadcn/`. Same manual-move fix as Magic UI —
check where the file actually landed after running `add` and move it into
`vendor-ui/aceternity/` if needed.

## _inbox

Custom components that aren't from any vendor library — either hand-written for
ARCLUX specifically, or adapted from a one-off snippet (CodePen, gist, etc.) found
during development. Current contents:

| File | Purpose |
|---|---|
| `neon-glow-card.tsx` | Card with a soft neon border glow, for emphasizing a single selected element (e.g. selected graph node) |
| `code-block-terminal.tsx` | Terminal-chrome code block with copy button, for showing snippets/config/commands |
| `graph-particles-bg.tsx` | Ambient canvas background of connected drifting particles, echoing ARCLUX's own dependency graph |
| `keyboard-shortcut-hint.tsx` | Renders a key combo (⌘K etc.), Mac-symbol-aware |

When adding something new here, prefer writing it from scratch over pulling from
a random CodePen search — a lot of what turns up there is SEO-spam pens with no
real code in them, not worth the time sink of verifying.

## Adding a new component, generally

1. Figure out which library it's from (or that it's custom → `_inbox/`)
2. Run that library's install command (see sections above)
3. Verify where the file actually landed — don't assume `aliases.ui` was respected
4. If it landed in the wrong folder, `mv` it to the correct `vendor-ui/<library>/`
   and fix any imports referencing the old path:
   ```bash
   grep -rl "@/components/ui/<name>" --include="*.tsx" --include="*.ts" . \
     | xargs -r sed -i 's|@/components/ui/<name>|@/vendor-ui/<library>/<name>|g'
   ```
5. Confirm `components/ui/` is empty again before committing
