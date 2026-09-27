// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5VesselActor.cpp — Slice 1. Tick = render snapshot. Input = intent.
// Mirror input.ts: STEP 2600, KeyStep (W 1.5/S/A/D 1.0, Q/E 0.8),
// boost 2.2x, brake = target posisi sendiri, brake selalu dikirim.
// Gagal gate? Cek server nyala → /snapshot ada → field sama → intent di log.

#include "UE5VesselActor.h"
#include "UE5Transport.h"
#include "UE5IntentFactory.h"

AUE5VesselActor::AUE5VesselActor()
{
	PrimaryActorTick.bCanEverTick = true;
	HullMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HullMesh"));
	SetRootComponent(HullMesh);
	MovementVis = CreateDefaultSubobject<UVesselMovementVis>(TEXT("MovementVis"));
}

void AUE5VesselActor::BeginPlay()
{
	Super::BeginPlay();
	// Demo slice 1: actor terima input langsung. Produksi: Pawn + IMC (aset editor).
	if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		EnableInput(PC);
	}
}

void AUE5VesselActor::SetupPlayerInputComponent(UInputComponent* IC)
{
	Super::SetupPlayerInputComponent(IC);
	IC->BindAxis(TEXT("MoveForward"), this, &AUE5VesselActor::AxisForward);
	IC->BindAxis(TEXT("MoveRight"), this, &AUE5VesselActor::AxisRight);
	IC->BindAxis(TEXT("MoveUp"), this, &AUE5VesselActor::AxisUp);
	IC->BindAxis(TEXT("Turn"), this, &AUE5VesselActor::AxisTurn);
	IC->BindAxis(TEXT("LookUp"), this, &AUE5VesselActor::AxisLookUp);
	IC->BindAction(TEXT("Boost"), IE_Pressed, this, &AUE5VesselActor::ActBoostPressed);
	IC->BindAction(TEXT("Boost"), IE_Released, this, &AUE5VesselActor::ActBoostReleased);
	IC->BindAction(TEXT("Brake"), IE_Pressed, this, &AUE5VesselActor::ActBrakePressed);
	IC->BindAction(TEXT("Brake"), IE_Released, this, &AUE5VesselActor::ActBrakeReleased);
	IC->BindAction(TEXT("Fire"), IE_Pressed, this, &AUE5VesselActor::ActFire);
	IC->BindAction(TEXT("Camera"), IE_Pressed, this, &AUE5VesselActor::ActCamera);
}

// Q naik / E turun (SAMA dengan settings.ts:59-60). W maju 1.5x.
void AUE5VesselActor::AxisForward(float V) { PendingInput.X = V * (V < 0 ? 1.5 : 1.0); }
void AUE5VesselActor::AxisRight(float V) { PendingInput.Y = V; }
void AUE5VesselActor::AxisUp(float V) { PendingInput.Z = V * 0.8; }
void AUE5VesselActor::AxisTurn(float V) { LookYaw += V * 0.6; }   // lookSensitivity
void AUE5VesselActor::AxisLookUp(float V) { LookPitch = FMath::Clamp(LookPitch + V * 0.6, -1.4, 1.4); }
void AUE5VesselActor::ActBoostPressed() { bBoostHeld = true; }
void AUE5VesselActor::ActBoostReleased() { bBoostHeld = false; }
void AUE5VesselActor::ActBrakePressed() { bBrakeHeld = true; }
void AUE5VesselActor::ActBrakeReleased() { bBrakeHeld = false; }
void AUE5VesselActor::ActFire() { RequestAttack(); }
void AUE5VesselActor::ActCamera() { CycleCamera(); }

void AUE5VesselActor::ApplySnapshot(const FUE5Vessel& Vessel, int64 Tick)
{
	VesselState = Vessel;
	MovementVis->PushSnapshot(Vessel.Base.Position, Vessel.Base.Velocity, Tick);
}

void AUE5VesselActor::CycleCamera()
{
	CamMode = static_cast<EUE5CamMode>((static_cast<uint8>(CamMode) + 1) % 5);
}

void AUE5VesselActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Render: posisi = interpolasi snapshot (bukan prediksi).
	const FUE5Vec3 P = MovementVis->SamplePosition(FPlatformTime::Seconds());
	SetActorLocation(FVector(P.X, P.Y, P.Z));

	// Brake selalu dikirim (biar vessel berhenti); gerak cuma saat ada input.
	if (Transport && (bBrakeHeld || !PendingInput.IsNearlyZero()))
	{
		const double Now = FPlatformTime::Seconds();
		if (Now - LastIntentTimeSec >= 0.1)
		{
			LastIntentTimeSec = Now;
			RequestMove(PendingInput, bBoostHeld, bBrakeHeld);
		}
	}
}

void AUE5VesselActor::RequestMove(const FVector& Dir, bool bBoost, bool bBrake)
{
	if (!Transport) return;
	const FUE5Vec3& Base = MovementVis->SamplePosition(FPlatformTime::Seconds());
	Transport->SendIntent(UUE5IntentFactory::BuildMoveIntent(
		VesselState.Base.OwnerId, VesselState.Base.Id.ToString(),
		Base.X, Base.Y, Base.Z, Dir.X, Dir.Y, Dir.Z, bBoost, bBrake, NextSeq++));
}

void AUE5VesselActor::RequestAttack()
{
	if (!Transport) return;
	Transport->SendIntent(UUE5IntentFactory::BuildAttackIntent(
		VesselState.Base.OwnerId, VesselState.Base.Id.ToString(), TEXT("plasma"), NextSeq++));
}
