// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5IntentFactory.h — pure static intent builder (testable, tanpa duplikat).
// Mirror apps/game input.ts EXACT: STEP 2600, KeyStep, boost 2.2x,
// brake = target posisi sendiri, attack plasma. Dipakai Actor + Pawn.

#pragma once

#include "CoreMinimal.h"
#include "UE5Types.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "UE5IntentFactory.generated.h"

UCLASS()
class UE5_API UUE5IntentFactory : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	static constexpr double MoveStep = 2600.0; // input.ts:76 STEP
	static constexpr double BoostFactor = 2.2; // input.ts:94

	// Intent "move": payload POSISI TARGET {x,y,z} meter (input.ts:95-107).
	static FUE5Intent BuildMoveIntent(const FString& PlayerId, const FString& EntityId,
		double CurX, double CurY, double CurZ,
		double DirX, double DirY, double DirZ,
		bool bBoost, bool bBrake, int64 Seq);

	// Intent "attack" (input.ts:118). Targeting penuh di Slice 4.
	static FUE5Intent BuildAttackIntent(const FString& PlayerId, const FString& EntityId,
		const FString& Weapon, int64 Seq);
};
