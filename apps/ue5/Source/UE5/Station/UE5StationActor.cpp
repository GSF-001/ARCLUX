// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5StationActor.cpp — Slice 2. Dock = teleport server-side; klien render.

#include "UE5StationActor.h"
#include "UE5Transport.h"
#include "UE5IntentFactory.h"
#include "Components/SphereComponent.h"

AUE5StationActor::AUE5StationActor()
{
	PrimaryActorTick.bCanEverTick = false;
	HubMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HubMesh"));
	SetRootComponent(HubMesh);
	RingMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("RingMesh"));
	RingMesh->SetupAttachment(RootComponent);
	SafeZone = CreateDefaultSubobject<USphereComponent>(TEXT("SafeZone"));
	SafeZone->SetupAttachment(RootComponent);
	SafeZone->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	SafeZone->SetHiddenInGame(false); // ring visual zona (opacity di material editor)
}

void AUE5StationActor::ApplySnapshot(const FUE5Station& Station)
{
	StationState = Station;
	SetActorLocation(FVector(Station.Base.Position.X, Station.Base.Position.Y, Station.Base.Position.Z));
	SafeZone->SetSphereRadius(static_cast<float>(Station.SafeZoneRadius), false);
}

bool AUE5StationActor::IsInDockRange(const FVector& VesselPos) const
{
	// Mirror validator.ts:154 — distanceBetween > safeZoneRadius*2 → "out of docking range".
	const double D = FVector::Dist(VesselPos, GetActorLocation());
	return D <= StationState.SafeZoneRadius * 2.0;
}

void AUE5StationActor::RequestDock(const FString& PlayerId, const FString& VesselId, int64& NextSeq)
{
	if (!Transport) return;
	FUE5Intent Intent;
	Intent.PlayerId = PlayerId;
	Intent.EntityId = VesselId;
	Intent.Type = TEXT("dock"); // key SAMA dengan TS
	Intent.PayloadJson = FString::Printf(TEXT("{\"stationId\":\"%s\"}"), *StationState.Base.Id.ToString());
	Intent.Seq = NextSeq++;
	Transport->SendIntent(Intent);
}
