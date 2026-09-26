// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// VesselMovementVis.h — Slice 1 interpolasi visual (presentation only).
// snapshot 10Hz → alpha seperti apps/game vessels.ts. Kebenaran tetap
// simulation.ts p+=v*dt. NOL prediksi, NOL Date.now di logic.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ArcluxTypes.h"
#include "VesselMovementVis.generated.h"

UCLASS(ClassGroup = (ARCLUX), meta = (BlueprintSpawnableComponent))
class ARCLUXUE_API UVesselMovementVis : public UActorComponent
{
	GENERATED_BODY()

public:
	// Dipanggil tiap OnSnapshot (10Hz). Simpan prev/curr + waktu.
	UFUNCTION(BlueprintCallable)
	void PushSnapshot(const FArcluxVec3& Pos, const FArcluxVec3& Vel, int64 Tick);

	// Dipanggil tiap frame render. Alpha = (now - tickT)/0.1, clamp 0..1.
	UFUNCTION(BlueprintCallable)
	FArcluxVec3 SamplePosition(double NowSec) const;

private:
	FArcluxVec3 PrevPos; FArcluxVec3 CurrPos;
	FArcluxVec3 CurrVel;
	int64 PrevTick = -1; int64 CurrTick = -1;
	double PrevTimeSec = 0; double CurrTimeSec = 0;
};
