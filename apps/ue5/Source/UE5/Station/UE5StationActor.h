// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5StationActor.h — Slice 2 (hub + ring + safe-zone visual).
// Mirror packages/gameserver: StationEntity (types.ts:72) + validateDock
// (validator.ts:140: station valid + wreck tidak bisa + jarak ≤ safeZone*2).
// Dock = intent "dock" {stationId} → server teleport kapal ke stasiun
// (simulation.ts:211). Visual safe-zone = sphere, bukan otoritas.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UE5Types.h"
#include "UE5StationActor.generated.h"

class UUE5Transport;

UCLASS()
class UE5_API AUE5StationActor : public AActor
{
	GENERATED_BODY()

public:
	AUE5StationActor();

	// Hub + ring (aset stasiun komunitas). Mesh di-assign di editor PC.
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	UStaticMeshComponent* HubMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	UStaticMeshComponent* RingMesh;

	// Visual safe-zone (radius = snapshot, default 1000m). Bukan otoritas.
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class USphereComponent* SafeZone;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	UUE5Transport* Transport;

	// Terapkan snapshot server. Radius sphere ikut safeZoneRadius.
	UFUNCTION(BlueprintCallable)
	void ApplySnapshot(const FUE5Station& Station);

	// Pre-check klien (SAMA dengan validator.ts:154): jarak > safeZone*2 = pasti reject.
	// Benar ditolak/diizinkan tetap server. Menghemat 1 round-trip, bukan otoritas.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	bool IsInDockRange(const FVector& VesselPos) const;

	// Intent "dock" {stationId} (simulation.ts:212).
	UFUNCTION(BlueprintCallable)
	void RequestDock(const FString& PlayerId, const FString& VesselId, int64& NextSeq);

	UFUNCTION(BlueprintCallable, BlueprintPure)
	FGuid GetStationId() const { return StationState.Base.Id; }

private:
	FUE5Station StationState;
};
