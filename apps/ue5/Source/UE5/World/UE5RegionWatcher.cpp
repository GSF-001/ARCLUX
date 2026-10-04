// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5RegionWatcher.h"
#include "UE5Transport.h"

UUE5RegionWatcher::UUE5RegionWatcher()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UUE5RegionWatcher::BeginPlay()
{
	Super::BeginPlay();
	if (Transport)
	{
		Transport->OnSnapshot.AddDynamic(this, &UUE5RegionWatcher::HandleSnapshot);
	}
}

void UUE5RegionWatcher::HandleSnapshot(const FUE5Snapshot& Snapshot)
{
	FeedSnapshot(Snapshot);
}

void UUE5RegionWatcher::FeedSnapshot(const FUE5Snapshot& Snapshot)
{
	if (Snapshot.RegionId == CurrentRegionId) return;
	const FString Old = CurrentRegionId;
	CurrentRegionId = Snapshot.RegionId;
	OnRegionChanged.Broadcast(Old, CurrentRegionId);
}
