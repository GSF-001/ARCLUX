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
- [x] `Vessel/UE5VesselActor.h/.cpp` (ApplySnapshot + RequestMove intent `move` + WASD)
- [ ] IMC Pawn proper (aset editor PC) + HUD baca tick
- Gate: vessel server kelihatan + WASD gerak + HUD baca tick. GAGAL = STOP TOTAL.

## Slice 2 — Planet + station + dock
- [ ] `PlanetaryReader` (EnvironmentalContext → GradeMood/CockpitState, rumus SAMA)
- [ ] `StationActor` + intent `dock` + interior UMG placeholder
- Gate: fly → dock → interior tanpa crash.

## Slice 3 — Material + Lumen + cuaca (§7 tabel M1/L1/A1-A4)
- [ ] `M_Hull + T_*` (seed SAMA) + Lumen rig + 1 storm Niagara
- Gate: banded screenshot browser vs UE mirip.

## Slice 4 — Senjata + damage (W1+D1 + 06 §4.8 + lapis EVE 06 §2.7)
- [ ] `NS_Weapon_*` pool (tracer 64/beam 8/missile 12/impact 200) + material swap
- Gate: duel 2 vessel kill full + damage terbaca.

## Slice 5 — UMG + NPE (U1-U12 + 06 HUD kontekstual + 05 §3.5 polisi)
- [ ] TAC/VESSEL/slot + NPE 5 menit + Heat/bodycam widget
- Gate: pemain baru 5 menit ke hangar tanpa wiki.

## Slice 6 — Multi + shard + Studio (07)
- [ ] Directory + gate transit + `FUE5Colony` + 5 intent colony/studio
- Gate: 2 pemain 2 region handoff tanpa duplikat. Replication MMO DILARANG.
