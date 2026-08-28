# ARCLUX Blueprint Progress — Index

Keputusan desain & arsitektur untuk **ARCLUX MMO Universe** (produk game,
terpisah dari engine ARCLUX). Ini catatan progres desain blueprint — bukan
engine code-intelligence (yang tercatat di `progres/`).

## Mengapa terpisah

ARCLUX punya dua hal yang beda kelas:

- **Engine ARCLUX** (sudah OP): parser, graph, detector, impact, DSL, daemon —
  code-intelligence. Ini tercatat di `progres/`.
- **ARCLUX MMO** (baru/desain): universe persistent, game server, game client,
  community/ownership/social. Bukan bagian dari `apps/web` — ini produk game.

Folder ini mencatat semua keputusan desain MMO supaya gak nyampur dengan
keputusan engine.

## Isi

| File | Isi |
|---|---|
| [decisions-mmo.md](decisions-mmo.md) | Semua keputusan desain MMO yang diambil (visi, arsitektur, stack, model) |
| [arsitektur.md](arsitektur.md) | Peta arsitektur MMO (server authoritative, client, shard registry) |
| [MMO-IMPLEMENTATION.md](MMO-IMPLEMENTATION.md) | **Peta implementasi anti-lupa** (status tiap modul + arah + checklist + TODO). Baca ini DULU sebelum ngoding MMO |

## Files blueprint terkait

- [../01-spatial-ux.md](../01-spatial-ux.md) — Spatial Universe & Navigation UX
- [../02-station-infrastructure.md](../02-station-infrastructure.md) — Station & Infrastructure
- [../03-combat.md](../03-combat.md) — Combat & World Validator
- [../04-wreckage-history.md](../04-wreckage-history.md) — Wreckage & Hall of Fame
- [../05-vessel-design-dashboard.md](../05-vessel-design-dashboard.md) — Vessel Design & 3D Dashboard
- [../06-community-social-ownership.md](../06-community-social-ownership.md) — Community, Social & Ownership

## Notes

- Desain dibahas sampai final SEBELUM diimplementasi (peraturan user).
- Jangan auto-merge PR — selalu review dulu.
