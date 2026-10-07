# ARCLUX Docs

Docs untuk ARCLUX. **Ada dua lapis yang saling melengkapi:**

1. **Mintlify-style content** — `docs.json` + halaman `.mdx` di root
   (`overview`, `quickstart`, `usage`, `tutorial`, …), plus `map/`,
   `progres/`, `blueprint/`. Ini sumber kebenaran konten.
2. **Docusaurus 3 (yang di-deploy ke GitHub Pages)** — dibangun dari
   content di atas, dengan UI custom:
   - `src/css/custom.css` — design system (Fraunces + Inter + JetBrains Mono,
     palet warm paper/clay, dark mode)
   - `src/pages/index.js` — landing page
   - `src/components/mintlify.jsx` + `src/theme/MDXComponents.js` — renderer
     untuk tag Mintlify (`<Card>`, `<Note>`, `<Warning>`, `<Accordion>`,
     `<Steps>`, …) supaya bisa dipakai di Docusaurus juga
   - 4 docs plugin: main (`/`), `map/`, `progres/`, `blueprint/`

## Cara jalanin

```bash
pnpm install
pnpm start        # dev server di http://localhost:3000
```

## Build (production)

```bash
pnpm build        # output di build/
```

`pnpm build` di-*gate* oleh CI (`deploy-docs.yml`) — kalau build gagal,
satu commit juga gagal deploy.

## Regenerasi konten

Jangan edit file di bawah ini manual — semuanya di-generate dari sumber
di root repo. Ubah sumbernya, lalu jalankan generator ulang:

```bash
node scripts/generate-docs.js            # docs/docs/*.md  (Docusaurus)
node scripts/generate-docs-mintlify.js   # docs-site/*.mdx + map/ + progres/ + blueprint/ + docs.json nav
```

`generate-docs-mintlify.js` juga **otomatis rebuild nav `docs.json`** dari
file yang benar-benar ada, jadi halaman baru (map/blueprint/progres) gak
perlu di-register manual lagi.

## Struktur

```
docs-site/
  docs.json              # config Mintlify (nav auto-rebuild dari generator)
  *.mdx                 # halaman Mintlify (overview, usage, tutorial, …)
  map/                  # 59 halaman per-package/app (intelligence/platform/apps)
  progres/               # 11 halaman detail progress
  blueprint/             # 29 halaman blueprint MMO + progres UE
  docs/                  # halaman Docusaurus (duplicate content utk deploy)
  src/
    css/custom.css       # design system
    pages/index.js       # homepage
    pages/index.module.css
    components/mintlify.jsx  # renderer tag Mintlify
    theme/MDXComponents.js   # registrasi ke MDX Docusaurus
  docusaurus.config.js   # 4 docs plugin + navbar + footer + fonts
  sidebars.js            # sidebar utama
  sidebars-map.js / -progres.js / -blueprint.js
```

## Kebijakan

- `build/` dan `node_modules/` gak di-commit (gitignore).
- Setiap perubahan konten di repo → jalankan dua generator → `pnpm build`
  → commit. Build yang gagal = CI merah.