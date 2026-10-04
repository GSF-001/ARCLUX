// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5RegionWatcher.h — Slice 6: gate transit presentation. UE cuma MENGAWASI
// RegionId dari snapshot (server otoritas); saat berubah = vessel handoff
// (gate.ts 2-fase, server). UE TIDAK memutuskan pindah — hanya menampilkan
// transit (overlay/UMG di editor) dan mereset interpolasi visual.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UE5Types.h"
#include "UE5RegionWatcher.generated.h"

class UUE5Transport;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnUE5RegionChanged, const FString&, OldRegionId, const FString&, NewRegionId);

UCLASS(ClassGroup = (ARCLUX), meta = (BlueprintSpawnableComponent))
class UE5_API UUE5RegionWatcher : public UActorComponent
{
	GENERATED_BODY()

public:
	UUE5RegionWatcher();

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	UUE5Transport* Transport = nullptr;

	UPROPERTY(BlueprintAssignable)
	FOnUE5RegionChanged OnRegionChanged;

	UPROPERTY(BlueprintReadOnly)
	FString CurrentRegionId;

	// Dipanggil tiap OnSnapshot. Broadcast hanya saat RegionId berubah.
	UFUNCTION(BlueprintCallable)
	void FeedSnapshot(const FUE5Snapshot& Snapshot);

protected:
	virtual void BeginPlay() override;

private:
	void HandleSnapshot(const FUE5Snapshot& Snapshot);
};
