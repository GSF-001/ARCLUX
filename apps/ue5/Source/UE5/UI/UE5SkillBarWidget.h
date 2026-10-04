// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5SkillBarWidget.h — Slice 5 06 §2.6: ship (engine/weapons/shield/nav)
// atau FPS (combat/stealth/survival/technical), 4 slot. Hanya muncul di
// Scan/Combat, slide 0.3s saat mode ganti. Update hanya saat state berubah.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UE5SkillBarWidget.generated.h"

UENUM(BlueprintType)
enum class EUE5ActiveMode : uint8
{
	Ship UMETA(DisplayName = "SHIP"),
	Fps  UMETA(DisplayName = "FPS")
};

UCLASS()
class UE5_API UUE5SkillBarWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadOnly)
	EUE5ActiveMode ActiveMode = EUE5ActiveMode::Ship;

	UPROPERTY(BlueprintReadOnly)
	bool bVisible = false; // Scan/Combat saja

	UPROPERTY(BlueprintReadOnly)
	TArray<FString> Slots;

	UFUNCTION(BlueprintCallable)
	void SetActiveMode(EUE5ActiveMode Mode);

	UFUNCTION(BlueprintCallable)
	void SetVisibleForContext(bool bScanOrCombat);

	// Nama 4 skill per mode (mirror 06 §2.2/§2.3).
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static TArray<FString> SkillNames(EUE5ActiveMode Mode);

	// UMG editor: slide out→in 0.3s (bukan pop).
	UFUNCTION(BlueprintImplementableEvent)
	void OnModeSwapped(EUE5ActiveMode NewMode);
};
