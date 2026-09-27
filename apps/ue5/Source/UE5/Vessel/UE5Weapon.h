// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5Weapon.h — Slice 4 (senjata + damage visual).
// Mirror W1 (weapons.ts) + combat.ts + damage.ts:
// archetype projectile/beam/missile/drone/area, pool caps tracer 64 / beam 8 /
// missile 12 / impact 200 (recycle oldest), cooldown tick missile 6 / emp 8 /
// explosive 10 / lain 4, damage level OK>0.6 / DAMAGED 0.25-0.6 / DISABLED<0.25.
// VFX (Niagara) = event → diisi di editor PC. Angka dari server SAJA.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UE5Weapon.generated.h"

// Archetype visual (mirror weapons.ts:82).
UENUM(BlueprintType)
enum class EUE5WeaponArch : uint8
{
	Projectile UMETA(DisplayName = "PROJECTILE"), // tracer 1200 u/s
	Beam       UMETA(DisplayName = "BEAM"),       // telegraph 0.2s + 0.8s
	Missile    UMETA(DisplayName = "MISSILE"),    // cone + trail
	Drone      UMETA(DisplayName = "DRONE"),
	Area       UMETA(DisplayName = "AREA")        // shockwave ring
};

// Level kerusakan visual (mirror damage.ts): swap material di Blueprint.
UENUM(BlueprintType)
enum class EUE5DamageLevel : uint8
{
	OK       UMETA(DisplayName = "OK"),       // health > 0.6
	Damaged  UMETA(DisplayName = "DAMAGED"),  // 0.25..0.6
	Disabled UMETA(DisplayName = "DISABLED")  // < 0.25
};

UCLASS(ClassGroup = (UE5), meta = (BlueprintSpawnableComponent))
class UE5_API UUE5Weapon : public UActorComponent
{
	GENERATED_BODY()

public:
	// Pool caps §4.4.3 (SAMA dengan W1). Lebih = queue, bukan spike.
	static constexpr int32 PoolTracer = 64;
	static constexpr int32 PoolBeam = 8;
	static constexpr int32 PoolMissile = 12;
	static constexpr int32 PoolImpact = 200;

	// Tembak: cek cooldown tick (mirror combat.ts:115) → intent attack → event VFX.
	// TargetId kosong = server abaikan (targeting UI sisa Slice 4).
	UFUNCTION(BlueprintCallable)
	bool Fire(const FString& WeaponId, const FVector& From, const FVector& To,
		const FString& TargetId, int64 Tick, int64& NextSeq,
		const FString& PlayerId, const FString& EntityId, class UUE5Transport* Transport);

	// Health 0..100 → level visual (mirror damage.ts). Event hanya saat level berubah.
	UFUNCTION(BlueprintCallable)
	void PushHealth(double Health01);

	// Warna muzzle (mirror weapons.ts:493): beam biru, missile oranye, lain amber.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FLinearColor MuzzleColor(EUE5WeaponArch Arch);

	UFUNCTION(BlueprintImplementableEvent)
	void OnPlayTracer(const FVector& From, const FVector& To, FLinearColor Tint);
	UFUNCTION(BlueprintImplementableEvent)
	void OnPlayBeam(const FVector& From, const FVector& To, double Width);
	UFUNCTION(BlueprintImplementableEvent)
	void OnPlayMissile(const FVector& From, const FVector& To);
	UFUNCTION(BlueprintImplementableEvent)
	void OnPlayImpact(const FVector& At, EUE5WeaponArch Arch);
	UFUNCTION(BlueprintImplementableEvent)
	void OnDamageLevelChanged(EUE5DamageLevel NewLevel);

private:
	TMap<FString, int64> CooldownUntil; // weaponId → tick boleh tembak lagi
	EUE5DamageLevel CurLevel = EUE5DamageLevel::OK;

	// Mirror combat.ts:86 (subsystem target) + :115 (cooldown tick).
	static EUE5WeaponArch ArchOf(const FString& WeaponId);
	static int64 CooldownTicks(const FString& WeaponId);
};
