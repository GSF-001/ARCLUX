// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5VesselPawn.cpp — Pawn lokal. Intent via UE5IntentFactory (tanpa duplikat).

#include "UE5VesselPawn.h"
#include "UE5Transport.h"
#include "UE5IntentFactory.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"

AUE5VesselPawn::AUE5VesselPawn()
{
	PrimaryActorTick.bCanEverTick = true;
	HullMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HullMesh"));
	SetRootComponent(HullMesh);
	MovementVis = CreateDefaultSubobject<UVesselMovementVis>(TEXT("MovementVis"));

	OrbitBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("OrbitBoom"));
	OrbitBoom->SetupAttachment(RootComponent);
	OrbitBoom->TargetArmLength = 1200.0f;

	OrbitCam = CreateDefaultSubobject<UCameraComponent>(TEXT("OrbitCam"));
	OrbitCam->SetupAttachment(OrbitBoom);

	CockpitCam = CreateDefaultSubobject<UCameraComponent>(TEXT("CockpitCam"));
	CockpitCam->SetupAttachment(RootComponent);
	CockpitCam->SetRelativeLocation(FVector(220.0, 0.0, 120.0)); // kepala pilot
	CockpitCam->SetRelativeRotation(FRotator(-5.0, 0.0, 0.0));
	CockpitCam->FieldOfView = 90.0f;

	TacticalCam = CreateDefaultSubobject<UCameraComponent>(TEXT("TacticalCam"));
	TacticalCam->SetupAttachment(RootComponent);
	TacticalCam->SetRelativeLocation(FVector(0.0, 0.0, 8000.0));
	TacticalCam->SetRelativeRotation(FRotator(-90.0, 0.0, 0.0));

	AutoPossessPlayer = EAutoReceiveInput::Player0;
}

void AUE5VesselPawn::BeginPlay()
{
	Super::BeginPlay();
	CockpitBaseLoc = CockpitCam->GetRelativeLocation();
	RefreshActiveCamera();
}

void AUE5VesselPawn::SetupPlayerInputComponent(UInputComponent* IC)
{
	Super::SetupPlayerInputComponent(IC);
	IC->BindAxis(TEXT("MoveForward"), this, &AUE5VesselPawn::AxisForward);
	IC->BindAxis(TEXT("MoveRight"), this, &AUE5VesselPawn::AxisRight);
	IC->BindAxis(TEXT("MoveUp"), this, &AUE5VesselPawn::AxisUp);
	IC->BindAxis(TEXT("Turn"), this, &AUE5VesselPawn::AxisTurn);
	IC->BindAxis(TEXT("LookUp"), this, &AUE5VesselPawn::AxisLookUp);
	IC->BindAction(TEXT("Boost"), IE_Pressed, this, &AUE5VesselPawn::ActBoostPressed);
	IC->BindAction(TEXT("Boost"), IE_Released, this, &AUE5VesselPawn::ActBoostReleased);
	IC->BindAction(TEXT("Brake"), IE_Pressed, this, &AUE5VesselPawn::ActBrakePressed);
	IC->BindAction(TEXT("Brake"), IE_Released, this, &AUE5VesselPawn::ActBrakeReleased);
	IC->BindAction(TEXT("Fire"), IE_Pressed, this, &AUE5VesselPawn::ActFire);
	IC->BindAction(TEXT("Camera"), IE_Pressed, this, &AUE5VesselPawn::ActCamera);
}

void AUE5VesselPawn::AxisForward(float V) { PendingInput.X = V * (V < 0 ? 1.5 : 1.0); }
void AUE5VesselPawn::AxisRight(float V) { PendingInput.Y = V; }
void AUE5VesselPawn::AxisUp(float V) { PendingInput.Z = V * 0.8; }
void AUE5VesselPawn::AxisTurn(float V) { LookYaw += V * 0.6; }
void AUE5VesselPawn::AxisLookUp(float V) { LookPitch = FMath::Clamp(LookPitch + V * 0.6, -1.4, 1.4); }
void AUE5VesselPawn::ActBoostPressed() { bBoostHeld = true; }
void AUE5VesselPawn::ActBoostReleased() { bBoostHeld = false; }
void AUE5VesselPawn::ActBrakePressed() { bBrakeHeld = true; }
void AUE5VesselPawn::ActBrakeReleased() { bBrakeHeld = false; }

void AUE5VesselPawn::ActFire()
{
	if (!Transport) return;
	Transport->SendIntent(UUE5IntentFactory::BuildAttackIntent(
		VesselState.Base.OwnerId, VesselState.Base.Id.ToString(), TEXT("plasma"), NextSeq++));
}

void AUE5VesselPawn::ActCamera() { CycleCamera(); }

void AUE5VesselPawn::CycleCamera()
{
	CamMode = static_cast<EUE5CamMode>((static_cast<uint8>(CamMode) + 1) % 5);
	RefreshActiveCamera();
}

void AUE5VesselPawn::RefreshActiveCamera()
{
	// Cinematic + Free = OrbitCam digerakkan Sequencer/matinee (Slice 5). Default Orbit.
	OrbitCam->SetActive(CamMode == EUE5CamMode::Orbit || CamMode == EUE5CamMode::Cinematic || CamMode == EUE5CamMode::Free);
	CockpitCam->SetActive(CamMode == EUE5CamMode::Cockpit);
	TacticalCam->SetActive(CamMode == EUE5CamMode::Tactical);
}

void AUE5VesselPawn::ApplySnapshot(const FUE5Vessel& Vessel, int64 Tick)
{
	VesselState = Vessel;
	MovementVis->PushSnapshot(Vessel.Base.Position, Vessel.Base.Velocity, Tick);
}

void AUE5VesselPawn::ApplyCockpitShake(double ShakeX, double ShakeY)
{
	// ±3px compositor-only (04-graphics.md:116). Nol biaya di luar Cockpit.
	if (CamMode != EUE5CamMode::Cockpit) return;
	CockpitCam->SetRelativeLocation(CockpitBaseLoc + FVector(0.0, ShakeX, ShakeY));
}

void AUE5VesselPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	const FUE5Vec3 P = MovementVis->SamplePosition(FPlatformTime::Seconds());
	SetActorLocation(FVector(P.X, P.Y, P.Z));

	// Orbit boom ikut mouse-look (kamera lokal, bukan state server).
	OrbitBoom->SetRelativeRotation(FRotator(LookPitch * 57.3, LookYaw * 57.3, 0.0));

	if (Transport && (bBrakeHeld || !PendingInput.IsNearlyZero()))
	{
		const double Now = FPlatformTime::Seconds();
		if (Now - LastIntentTimeSec >= 0.1)
		{
			LastIntentTimeSec = Now;
			const FUE5Vec3& Cur = MovementVis->SamplePosition(Now);
			Transport->SendIntent(UUE5IntentFactory::BuildMoveIntent(
				VesselState.Base.OwnerId, VesselState.Base.Id.ToString(),
				Cur.X, Cur.Y, Cur.Z,
				PendingInput.X, PendingInput.Y, PendingInput.Z,
				bBoostHeld, bBrakeHeld, NextSeq++));
		}
	}
}
