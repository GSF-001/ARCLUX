# ARCLUX GAME — MMO Client (Electron + three.js)

> **PERMANEN** — arsitektur + run. Daftar file hidup ada di `arclux_file_info` / `folderGraph` / `docs/blueprint/progres/MMO-IMPLEMENTATION.md`, bukan di README. Commit baru (`physics.ts`/`component.ts`) gak perlu edit README lagi.

**Arch:** `apps/game` = renderer + input + net (D-008 client never authoritative). Server `packages/gameserver` yang hitung `environs`/`thermics`/`collision`/`baseline` heavy tapi stabil kayak EVE — client cuma render.

**Run (komputer, bukan mobile):**
```bash
pnpm install
pnpm --filter game dev          # Electron window + three.js scene
ARCLUX_GAME_PORT=8080 pnpm --filter game dev  # dynamic port (resolveGamePort)
npx electron apps/game          # direct
```
Net: `createHttpClientTransport(resolveGameUrl())` → `PlayerIntent` → `GameEvent` replay.

**Link:** `docs/blueprint/01-spatial-ux.md §20/§28` (HUD EVE), `05 §7.1` baseline, `06 §18` intel/teleport, `07` V4, `08` V6, `MMO-IMPLEMENTATION.md §3` checklist. Heavy-stable: `SimulationEngine` 10 ticks/sec, `tickScheduler` + `rateLimiter` di gameserver.
