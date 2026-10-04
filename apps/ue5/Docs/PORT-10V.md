# PORT-10V + BLUEPRINT — checklist eksekusi UE (jalur wajib)

> Sumber: `00-migrasi.md §7/§7A/§8`, `03-implementasi.md §2/§4`. File ini JALURNYA.
> Aturan: baris ⬜ = DILARANG mulai. 1 slice = 1 gate. Gate merah = STOP, bukan lembur.

## Slice 0 — Scaffold (INI, DONE di repo)
- [x] `UE5.uproject` (UE 5.5, DX12, plugin HTTP/JSON/UMG/Niagara/EnhancedInput)
- [x] `Config/` (Engine DX12+TSR+VSM+WP, Game URL :24001, Input penanda)
- [x] `Source/UE5/UE5.Build.cs` + `UE5.h/.cpp` (GameInstance boot)
- Gate: project kebuka + compile bersih di PC (TIDAK bisa di Termux — butuh Windows + UE5).

## Slice 1 — Connect + 1 vessel (INI, code DONE, belum compile)
- [x] `Transport/UE5Types.h` (mirror types.ts 1:1 + Weapon/Heat/Colony)
- [x] `Transport/UE5Transport.h/.cpp` (POST /intent retry 1x, GET /snapshot 100ms)
- [x] `Vessel/VesselMovementVis.h/.cpp` (interp alpha, presentation only)
- [x] `Vessel/UE5VesselActor.h/.cpp` (remote vessels, via IntentFactory)
- [x] `Vessel/UE5VesselPawn.h/.cpp` (kapal sendiri + rig Orbit/Cockpit/Tactical + shake)
- [x] `Vessel/UE5IntentFactory.h/.cpp` (pure, mirror input.ts — tanpa duplikat)
- [x] `Planetary/UE5PlanetaryReader.h/.cpp` (GradeMood + CockpitState bit-identik TS)
- [x] `UI/UE5Hud.h/.cpp` (Idle/Scan/Combat + hash-guard + auto-hide 3s)
- [ ] IMC Pawn proper (aset editor PC) + UMG visual + HUD baca tick
- Gate: vessel server kelihatan + WASD gerak + HUD baca tick. GAGAL = STOP TOTAL.

## Slice 2 — Planet + station + dock (INI code, belum compile PC)
- [x] `PlanetaryReader` (UE5PlanetaryReader — rumus SAMA, Slice 1)
- [x] `Station/UE5StationActor.h/.cpp` (hub+ring+safe-zone visual + IsInDockRange + RequestDock)
- [x] Pawn `RequestDock` (G) + `UI/UE5InteriorWidget` placeholder
- [ ] Interior full (port interior.ts) — Slice 5
- Gate: fly → dock → interior tanpa crash.

## Slice 3 — Material + Lumen + cuaca (§7 tabel M1/L1/A1-A4) (code DONE, belum compile)
- [x] `Planetary/UE5MaterialKit.h/.cpp` (M1.1 port bit-identik: mulberry32 + noise2D + hull albedo + roughness + normal Sobel)
- [x] `Planetary/UE5LightRigActor.h/.cpp` (key/fill/rim mirror lighting.ts, elevation rad → pitch, intensity dari sin(elev))
- [x] `Planetary/UE5StormDirector.h/.cpp` (weather.kind → OnWeatherChanged, IsStorm/IsPrecip)
- [ ] Editor PC: `M_Hull` + bake `T_*` via UE5MaterialKit, Lumen rig assign ke LightRigActor, `NS_Storm` Niagara bind ke StormDirector.OnWeatherChanged
- Gate: banded screenshot browser vs UE mirip.

## Slice 4 — Senjata + damage (INI code, belum Niagara PC)
- [x] `Vessel/UE5Weapon.h/.cpp` (archetype + pool caps + cooldown mirror combat.ts + damage level)
- [x] `BuildAttackIntent` bawa targetId (combat.ts:46 — kosong = server abaikan, bukan bug)
- [ ] `NS_Weapon_*` Niagara + material swap + targeting UI + duel 2 vessel
- Gate: kill full (large explosion + carcass) + damage terbaca.

## Slice 5 — UMG + NPE (U1-U12 + 06 HUD kontekstual + 05 §3.5 polisi) (code DONE, belum compile)
- [x] `UI/UE5Tokens.h/.cpp` (SATU sumber hex/font/glow/transition/glass — mirror tokens.ts)
- [x] `UI/UE5NpeWidget.h/.cpp` (5 langkah state-driven, centang dari event gameplay, skippable, OnFinished)
- [x] `UI/UE5SkillBarWidget.h/.cpp` (ship/FPS 4 slot, visible hanya Scan/Combat, swap slide 0.3s)
- [x] `UI/UE5WalletWidget.h/.cpp` (OC + format koma ribuan, OnOcChanged hologram)
- [x] `UI/UE5HeatWidget.h/.cpp` (wanted 0-5 + bodycam + tether warning, warna ok/warn/danger)
- [x] `UE5Hud::SetActiveMode` (ship/fps dari server, swap event)
- [ ] Editor PC: pasang DataTable DT_ArcluxColors/DT_ArcluxType, layout UMG (TAC kiri/VESSEL kanan/slot bawah, JANGAN pindah), glass material (§4.6.2), NPE overlay, skill bar slide
- Gate: pemain baru 5 menit ke hangar tanpa wiki.

## Slice 6 — Multi + shard + Studio (07)
- [ ] Directory + gate transit + `FUE5Colony` + 5 intent colony/studio
- Gate: 2 pemain 2 region handoff tanpa duplikat. Replication MMO DILARANG.
