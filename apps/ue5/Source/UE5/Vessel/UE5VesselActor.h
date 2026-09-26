// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5VesselActor.h — Slice 1 (gate: vessel server kelihatan + gerak full).
// Mirror apps/game input.ts + settings.ts + camera.ts + renderer.ts:
// gerak W/S/A/D + arrow, Q naik / E turun, Shift boost, Space brake,
// mouse-look (kamera lokal), F tembak, V ganti kamera (lokal).
// Presentation only: angka dari server SAJA. Mesh di-assign di editor PC.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UE5Types.h"
#include "VesselMovementVis.h"
#include "UE5VesselActor.generated.h"

class UUE5Transport;

// Mode kamera lokal (04-graphics.md:110). Server tidak peduli (presentasi saja).
UENUM(BlueprintType)
enum class EUE5CamMode : uint8
{
	Orbit    UMETA(DisplayName = "ORBIT"),
	Cockpit  UMETA(DisplayName = "COCKPIT"),
	Tactical UMETA(DisplayName = "TACTICAL"),
	Cinematic UMETA(DisplayName = "CINEMATIC"),
	Free     UMETA(DisplayName = "FREE")
};

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

	// Kamera aktif (lokal, tombol V berurutan). Bukan state server.
	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	EUE5CamMode CamMode = EUE5CamMode::Orbit;

	// Terapkan snapshot server (Tick dari FUE5Snapshot). Tidak pernah menulis state.
	UFUNCTION(BlueprintCallable)
	void ApplySnapshot(const FUE5Vessel& Vessel, int64 Tick);

	// Intent "move": payload POSISI TARGET {x,y,z} meter (SAMA dengan input.ts sendMove).
	UFUNCTION(BlueprintCallable)
	void RequestMove(const FVector& Dir, bool bBoost, bool bBrake);

	// Intent "attack" (input.ts:115 — F/J). Slice 4 isi targeting.
	UFUNCTION(BlueprintCallable)
	void RequestAttack();

	// V = kamera berikutnya (lokal saja, tidak kirim intent).
	UFUNCTION(BlueprintCallable)
	void CycleCamera();

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* IC);

private:
	FUE5Vessel VesselState;
	FVector PendingInput = FVector::ZeroVector; // world-axis (SAMA dengan tx/ty/tz)
	bool bBoostHeld = false;
	bool bBrakeHeld = false;
	double LookYaw = 0;   // kamera lokal (mirror lookYaw)
	double LookPitch = 0; // kamera lokal
	int64 NextSeq = 0;
	double LastIntentTimeSec = -1.0;

	void AxisForward(float V);
	void AxisRight(float V);
	void AxisUp(float V);
	void AxisTurn(float V);   // MouseX → yaw kamera
	void AxisLookUp(float V); // MouseY → pitch kamera
	void ActBoostPressed();
	void ActBoostReleased();
	void ActBrakePressed();
	void ActBrakeReleased();
	void ActFire();
	void ActCamera();
};
