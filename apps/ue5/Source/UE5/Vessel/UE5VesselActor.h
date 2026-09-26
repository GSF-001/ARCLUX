// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5VesselActor.h — Slice 1 (gate: vessel server kelihatan + WASD gerak).
// Presentation only: state dibaca dari snapshot, angka dari server SAJA.
// Mesh (SM_VesselHull) di-assign di editor PC. Proper IMC Pawn menyusul
// bareng asset input editor; actor ini EnableInput untuk demo slice 1.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UE5Types.h"
#include "VesselMovementVis.h"
#include "UE5VesselActor.generated.h"

class UUE5Transport;

UCLASS()
class UE5_API AUE5VesselActor : public AActor
{
	GENERATED_BODY()

public:
	AUE5VesselActor();

	// Badan kapal (aset, milik pemain). Otak = FUE5Vessel dari snapshot.
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	UStaticMeshComponent* HullMesh;

	// Interpolasi snapshot 10Hz → posisi mulus (presentation only).
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	UVesselMovementVis* MovementVis;

	// Transport ke server otoritatif (di-set spawner/PC).
	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	UUE5Transport* Transport;

	// Terapkan snapshot server (Tick dari FUE5Snapshot). Tidak pernah menulis state.
	UFUNCTION(BlueprintCallable)
	void ApplySnapshot(const FUE5Vessel& Vessel, int64 Tick);

	// Kirim intent "move" (JSON key SAMA dengan TS). Throttle 100ms.
	UFUNCTION(BlueprintCallable)
	void RequestMove(const FVector& Dir);

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* IC);

private:
	FUE5Vessel VesselState;
	FVector PendingInput = FVector::ZeroVector;
	int64 NextSeq = 0;
	double LastIntentTimeSec = -1.0;

	void AxisForward(float V);
	void AxisRight(float V);
	void AxisUp(float V);
};
