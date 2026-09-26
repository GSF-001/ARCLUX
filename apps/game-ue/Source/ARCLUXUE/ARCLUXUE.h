// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// ARCLUXUE.h — Slice 0 GameInstance: boot, server URL, tick poll.
// UE = presentasi. Tidak pernah menulis state (00-migrasi.md §0).

#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "ARCLUXUE.generated.h"

UCLASS()
class ARCLUXUE_API UARCLUXUEGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	// Server otoritatif tunggal (packages/gameserver :24001). Diisi dari DefaultGame.ini.
	UPROPERTY(Config)
	FString ServerBaseUrl = TEXT("http://127.0.0.1:24001");

	// Poll /snapshot tiap 100ms (bukan Tick — hemat). Presentation only.
	UPROPERTY(Config)
	float SnapshotIntervalSec = 0.1f;

	UPROPERTY(Config)
	float IntentTimeoutSec = 2.0f;

	virtual void Init() override;
	virtual void Shutdown() override;
};
