# ARCLUX Docs (Docusaurus)

Docs site statis untuk ARCLUX, dibangun pakai Docusaurus 3.

## Cara jalanin

```bash
pnpm install
pnpm start
```

Buka `http://localhost:3000`.

## Cara build (production)

```bash
pnpm build
```

Output ada di folder `build/` — bisa langsung di-deploy ke GitHub
Pages, Vercel, Netlify, dsb.

## Struktur

```
docs-site/
  docusaurus.config.js   # konfigurasi utama (title, navbar, dark mode)
  sidebars.js             # urutan sidebar
  src/css/custom.css      # styling (accent color, dark theme)
  docs/
    intro.md
    architecture.md
    stack.md
    gotchas.md
    roadmap.md
```

## Yang perlu diubah sebelum deploy

- `docusaurus.config.js` → ganti `url`, `baseUrl`, `organizationName`,
  `projectName` sesuai repo GitHub lo yang sebenarnya.
- `favicon.ico` belum ada — taruh di `static/img/favicon.ico`, atau
  hapus baris `favicon:` di config kalau gak perlu.
- Isi `docs/*.md` diambil dari context brief ARCLUX terbaru — update
  manual tiap kali arsitektur/gotcha berubah, docs ini gak otomatis
  sinkron sama codebase.

## Deploy ke GitHub Pages (opsional, paling gampang buat repo publik)

```bash
GIT_USER=<username-github> pnpm deploy
```
