// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5VesselActor.cpp — Slice 1. Tick = render snapshot. Input = intent.
// Gagal gate (vessel tidak gerak)? Cek: server nyala? /snapshot ada?
// JSON field sama? Intent sampai (log server)? (03-implementasi.md §4).

#include "UE5VesselActor.h"
#include "UE5Transport.h"

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
}

void AUE5VesselActor::AxisForward(float V) { PendingInput.X = V; }
void AUE5VesselActor::AxisRight(float V) { PendingInput.Y = V; }
void AUE5VesselActor::AxisUp(float V) { PendingInput.Z = V; }

void AUE5VesselActor::ApplySnapshot(const FUE5Vessel& Vessel, int64 Tick)
{
	VesselState = Vessel;
	MovementVis->PushSnapshot(Vessel.Base.Position, Vessel.Base.Velocity, Tick);
}

void AUE5VesselActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Render: posisi = interpolasi snapshot (bukan prediksi).
	const FUE5Vec3 P = MovementVis->SamplePosition(FPlatformTime::Seconds());
	SetActorLocation(FVector(P.X, P.Y, P.Z));

	// Input: WASD → intent move, throttle 100ms (samakan tick server).
	if (Transport && !PendingInput.IsNearlyZero())
	{
		const double Now = FPlatformTime::Seconds();
		if (Now - LastIntentTimeSec >= 0.1)
		{
			LastIntentTimeSec = Now;
			RequestMove(PendingInput);
		}
	}
}

void AUE5VesselActor::RequestMove(const FVector& Dir)
{
	if (!Transport) return;
	FUE5Intent Intent;
	Intent.PlayerId = VesselState.Base.OwnerId;
	Intent.EntityId = VesselState.Base.Id.ToString();
	Intent.Type = TEXT("move"); // key SAMA dengan TS
	Intent.PayloadJson = FString::Printf(TEXT("{\"dx\":%.3f,\"dy\":%.3f,\"dz\":%.3f}"),
		Dir.X, Dir.Y, Dir.Z);
	Intent.Seq = NextSeq++;
	Transport->SendIntent(Intent);
}
