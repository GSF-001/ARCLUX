// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5Weapon.cpp — mirror bit-akurat W1 + combat.ts. VFX = event (Niagara di PC).

#include "UE5Weapon.h"
#include "UE5Transport.h"
#include "UE5IntentFactory.h"

EUE5WeaponArch UUE5Weapon::ArchOf(const FString& WeaponId)
{
	// combat.ts:86 resolveTargetSubsystem + weapons.ts:82 archetype.
	if (WeaponId == TEXT("weapon.plasma") || WeaponId == TEXT("weapon.railgun")) return EUE5WeaponArch::Projectile;
	if (WeaponId == TEXT("weapon.missile")) return EUE5WeaponArch::Missile;
	if (WeaponId == TEXT("weapon.emp")) return EUE5WeaponArch::Beam;
	if (WeaponId == TEXT("weapon.explosive")) return EUE5WeaponArch::Area;
	return EUE5WeaponArch::Projectile;
}

int64 UUE5Weapon::CooldownTicks(const FString& WeaponId)
{
	// Mirror combat.ts:115 cooldownTicks.
	if (WeaponId == TEXT("weapon.missile")) return 6;
	if (WeaponId == TEXT("weapon.emp")) return 8;
	if (WeaponId == TEXT("weapon.explosive")) return 10;
	return 4;
}

FLinearColor UUE5Weapon::MuzzleColor(EUE5WeaponArch Arch)
{
	// Mirror weapons.ts:493.
	if (Arch == EUE5WeaponArch::Beam) return FLinearColor(0x88, 0xcc, 0xff);
	if (Arch == EUE5WeaponArch::Missile) return FLinearColor(0xff, 0x88, 0x44);
	return FLinearColor(0xff, 0xd6, 0x7a);
}

bool UUE5Weapon::Fire(const FString& WeaponId, const FVector& From, const FVector& To,
	const FString& TargetId, int64 Tick, int64& NextSeq,
	const FString& PlayerId, const FString& EntityId, UUE5Transport* Transport)
{
	if (!Transport) return false;
	// Cooldown klien = prediksi UX (server tetap vonis via cooldowns snapshot).
	const int64 ReadyAt = CooldownUntil.FindRef(WeaponId);
	if (Tick < ReadyAt) return false;
	CooldownUntil.Add(WeaponId, Tick + CooldownTicks(WeaponId));

	Transport->SendIntent(UUE5IntentFactory::BuildAttackIntent(
		PlayerId, EntityId, WeaponId, TargetId, NextSeq++));

	// VFX lokal langsung (gameplay tetap nunggu snapshot — presentasi only).
	const EUE5WeaponArch Arch = ArchOf(WeaponId);
	switch (Arch)
	{
	case EUE5WeaponArch::Beam: OnPlayBeam(From, To, 3.0); break; // width skala heat (W1)
	case EUE5WeaponArch::Missile: OnPlayMissile(From, To); break;
	default: OnPlayTracer(From, To, MuzzleColor(Arch)); break; // TTL dist/1200+0.1 di Niagara
	}
	return true;
}

void UUE5Weapon::PushHealth(double Health01)
{
	EUE5DamageLevel Want = EUE5DamageLevel::OK;
	if (Health01 < 0.25) Want = EUE5DamageLevel::Disabled;
	else if (Health01 <= 0.6) Want = EUE5DamageLevel::Damaged;
	if (Want != CurLevel)
	{
		CurLevel = Want;
		OnDamageLevelChanged(CurLevel); // Blueprint: swap material + VFX asap/api
	}
}
