# ARCLUX GAME — MMO Client (Electron + three.js)

> 🚧 **SCAFFOLD** — kerangka aplikasi, BELUM jalan. Baca
> `docs/blueprint/progres/MMO-IMPLEMENTATION.md` §2.4 sebelum implementasi.
>
> Client = **renderer + input + net**, TIDAK pernah jadi otoritas (D-008,
> invariant I-1). Semua posisi/damage/ownership datang dari gameserver.

## Struktur

```
apps/game/
├── package.json          # Electron + three
├── tsconfig.json
├── index.ts              # entry: bootstrap Electron
└── src/
    ├── main/             # Electron main process (jendela, lifecycle, IPC bridge)
    │   └── main.ts
    └── renderer/         # Electron renderer (3D universe + input + net)
        ├── index.html
        ├── renderer.ts   # bootstrap renderer (three scene)
        ├── scene3d.ts    # 3D vessel render dari RegionState (mesh/material/camera)
        └── net.ts        # wrapper netcode: kirim intent, terima events
```

## Arah implementasi (urutan)

1. `main/main.ts` — bootstrap jendela Electron + load `renderer/index.html`
2. `renderer/scene3d.ts` — render vessel dari `RegionState` (pakai `three`,
   fondasi sama kayak `apps/web` GraphCanvas3D)
3. `renderer/net.ts` — gabung `packages/gameserver/netcode.ts` (in-process
   dulu), kirim `PlayerIntent`, render events
4. UI universe (blueprint `01-spatial-ux.md`) setelah 3D dasar jalan
