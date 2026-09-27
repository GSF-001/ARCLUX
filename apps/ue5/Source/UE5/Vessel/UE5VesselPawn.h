// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5VesselPawn.h — Pawn LOKAL (possess + input native + rig kamera).
// Actor (UE5VesselActor) = vessel ORANG LAIN (render snapshot saja).
// Pawn = kapal SENDIRI: kirim intent + 3 kamera (Orbit/Cockpit/Tactical).
// Melebihi camera.ts: rig siap + shake kokpit + FOVADS hook Slice 4.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "UE5Types.h"
#include "VesselMovementVis.h"
#include "UE5VesselActor.h" // EUE5CamMode
#include "UE5VesselPawn.generated.h"

class UUE5Transport;

UCLASS()
class UE5_API AUE5VesselPawn : public APawn
{
	GENERATED_BODY()

public:
	AUE5VesselPawn();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	UStaticMeshComponent* HullMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	UVesselMovementVis* MovementVis;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	UUE5Transport* Transport;

	// Rig kamera: Orbit (boom 1200) + Cockpit (kepala pilot) + Tactical (top-down).
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class USpringArmComponent* OrbitBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class UCameraComponent* OrbitCam;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class UCameraComponent* CockpitCam;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class UCameraComponent* TacticalCam;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	EUE5CamMode CamMode = EUE5CamMode::Orbit;

	UFUNCTION(BlueprintCallable)
	void ApplySnapshot(const FUE5Vessel& Vessel, int64 Tick);

	UFUNCTION(BlueprintCallable)
	void CycleCamera();

	// Shake kokpit dari UE5PlanetaryReader (HANYA mode Cockpit, nol biaya di luarnya).
	UFUNCTION(BlueprintCallable)
	void ApplyCockpitShake(double ShakeX, double ShakeY);

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* IC) override;

private:
	FUE5Vessel VesselState;
	FVector PendingInput = FVector::ZeroVector;
	bool bBoostHeld = false;
	bool bBrakeHeld = false;
	double LookYaw = 0;
	double LookPitch = 0;
	int64 NextSeq = 0;
	double LastIntentTimeSec = -1.0;
	FVector CockpitBaseLoc;

	void AxisForward(float V);
	void AxisRight(float V);
	void AxisUp(float V);
	void AxisTurn(float V);
	void AxisLookUp(float V);
	void ActBoostPressed();
	void ActBoostReleased();
	void ActBrakePressed();
	void ActBrakeReleased();
	void ActFire();
	void ActCamera();
	void RefreshActiveCamera();
};
