// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5Transport.h — Slice 1 bridge (00-migrasi.md §4). Spec, bukan teori:
// POST /intent (queue + retry 1x, timeout 2s), GET /snapshot tiap 100ms,
// broadcast OnSnapshot. UE TIDAK validasi ulang — penolakan ditampilkan read-only.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "UE5Types.h"
#include "UE5Transport.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnUE5Snapshot, const FUE5Snapshot&, Snapshot);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnUE5IntentRejected, const FString&, IntentType, const FString&, Reason);

UCLASS(BlueprintType)
class UE5_API UUE5Transport : public UObject
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Config)
	FString ServerBaseUrl = TEXT("http://127.0.0.1:24001");

	// Poll /snapshot tiap 100ms (bukan Tick — hemat). Presentation only.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Config)
	float SnapshotIntervalSec = 0.1f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Config)
	float IntentTimeoutSec = 2.0f;

	UPROPERTY(BlueprintAssignable)
	FOnUE5Snapshot OnSnapshot;

	UPROPERTY(BlueprintAssignable)
	FOnUE5IntentRejected OnIntentRejected;

	UFUNCTION(BlueprintCallable)
	void StartPolling();

	UFUNCTION(BlueprintCallable)
	void StopPolling();

	// SendIntent(FUE5Intent) → POST /intent JSON (key SAMA dengan TS).
	UFUNCTION(BlueprintCallable)
	void SendIntent(const FUE5Intent& Intent);

private:
	FTimerHandle PollTimer;
	void PollOnce();
	int64 LastTickSeen = -1;
};
