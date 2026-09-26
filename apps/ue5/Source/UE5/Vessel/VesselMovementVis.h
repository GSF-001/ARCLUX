// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// VesselMovementVis.h — Slice 1 interpolasi visual (presentation only).
// snapshot 10Hz → alpha seperti apps/game vessels.ts. Kebenaran tetap
// simulation.ts p+=v*dt. NOL prediksi, NOL Date.now di logic.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UE5Types.h"
#include "VesselMovementVis.generated.h"

UCLASS(ClassGroup = (ARCLUX), meta = (BlueprintSpawnableComponent))
class UE5_API UVesselMovementVis : public UActorComponent
{
	GENERATED_BODY()

public:
	// Dipanggil tiap OnSnapshot (10Hz). Simpan prev/curr + waktu.
	UFUNCTION(BlueprintCallable)
	void PushSnapshot(const FUE5Vec3& Pos, const FUE5Vec3& Vel, int64 Tick);

	// Dipanggil tiap frame render. Alpha = (now - tickT)/0.1, clamp 0..1.
	UFUNCTION(BlueprintCallable)
	FUE5Vec3 SamplePosition(double NowSec) const;

private:
	FUE5Vec3 PrevPos; FUE5Vec3 CurrPos;
	FUE5Vec3 CurrVel;
	int64 PrevTick = -1; int64 CurrTick = -1;
	double PrevTimeSec = 0; double CurrTimeSec = 0;
};
