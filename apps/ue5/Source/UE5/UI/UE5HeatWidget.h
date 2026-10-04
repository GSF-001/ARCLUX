// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5HeatWidget.h — Slice 5 05 §2/§3.5: wanted 0–5 + bodycam. Baca-only:
// vonis record tetap server (05 §2.1). Heat naik = r/warn/danger token.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UE5HeatWidget.generated.h"

UCLASS()
class UE5_API UUE5HeatWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadOnly)
	int32 WantedLevel = 0; // 0..5

	UPROPERTY(BlueprintReadOnly)
	bool bBodycamOn = false;

	UPROPERTY(BlueprintReadOnly)
	bool bTetherWarning = false; // 01-assets §5 — blokir gerak + notice

	UFUNCTION(BlueprintCallable)
	void PushState(int32 InWantedLevel, bool bInBodycamOn, bool bInTetherWarning);

	// Warna severity per level (mirror tokens: ok→warn→danger).
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FString WantedColorToken(int32 InWantedLevel);
};
