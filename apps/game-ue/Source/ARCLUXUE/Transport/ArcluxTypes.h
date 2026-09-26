// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// ArcluxTypes.h — KONTRAK SUCI (03-implementasi.md §2). Field 1:1 dengan
// packages/gameserver/types.ts. TIPE + SATUAN sama (meter, m/s, tick).
// Ubah format = DILARANG (00-migrasi.md §0 butir 1). Nama boleh gaya UE.

#pragma once

#include "CoreMinimal.h"
#include "ArcluxTypes.generated.h"

// Vec3: meter (mirror types.ts:18).
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxVec3
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double X = 0; // meter
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Y = 0; // meter
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Z = 0; // meter
};

// GameEntity base (mirror types.ts:29). kind: vessel|station|character.
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxEntity
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FGuid Id;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Kind; // vessel|station|character
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString OwnerId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FArcluxVec3 Position; // meter
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FArcluxVec3 Velocity; // m/s
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double HeadingYaw = 0;   // radian
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double HeadingPitch = 0; // radian
};

// VesselEntity (mirror types.ts:43). Systems/cooldowns dibaca dari snapshot,
// TIDAK ditulis client. emergency: nominal|adrift|falling|crashed (10.E).
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxVessel
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FArcluxEntity Base;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString StateHash;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) TMap<FString, int32> Cooldowns; // ticks
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Emergency; // empty=nominal
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int64 EmergencyTick = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Hull = 100; // 0..100 mean systems
};

// StationEntity (mirror types.ts:72). safeZoneRadius meter (default 1000).
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxStation
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FArcluxEntity Base;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Name;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double SafeZoneRadius = 1000.0; // meter
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString CommunityId;
};

// RegionSnapshot (mirror types.ts:105). Apa yang snapshot() kembalikan.
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxSnapshot
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString RegionId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Name;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int64 Tick = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString CreatedAt;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<FArcluxVessel> Vessels;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<FArcluxStation> Stations;
};

// PlayerIntent (mirror types.ts:125). JSON key SAMA persis dengan TS.
// 10 intent: move, attack, activate_capability, dock, scan, teleport,
// spawn, spawn_character, trade_component, spawn_station (+ fps_*/colony_* 06/07).
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxIntent
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString PlayerId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString EntityId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Type; // JSON key SAMA
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString PayloadJson; // payload object
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int64 Seq = 0;
};

// EnvironmentalContext (mirror planetary/environment.ts → 03 §2.3). Field 1:1.
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxEnvironment
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString TimeOfDay;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double SunElevation = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString MoonState;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString WeatherKind;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Wind = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Precipitation = 0;
};

// FArcluxWeapon (mirror 06 §4.8 — angka mirror, bukan rumus baru).
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxWeapon
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString WeaponId; // rifle/smg/sniper/shotgun
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Damage = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double RangeM = 0; // meter
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double CooldownSec = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Ammo = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Durability = 100; // 0..100
};

// FArcluxHeat (mirror 05 §2.1 + §3.5). UE tampil, vonis server.
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxHeat
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString PlayerId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 WantedLevel = 0; // 0..5
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString LastSeenChunk;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int64 LastSeenTick = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bDisguised = false;
};

// FArcluxColony (mirror 07 §6 ← world.json + claim record).
USTRUCT(BlueprintType)
struct FARCLUXUE_API FArcluxColony
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FGuid ColonyId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString PlanetId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString FounderId;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString RuleHash;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString ClaimId; // 100×100m (02 §8.5)
};
