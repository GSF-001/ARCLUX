// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5NpeWidget.h — Slice 5 NPE (U10, 04-graphics §4.6.5). 5 langkah,
// centang OTOMATIS dari state (gameplay event), skippable, persisten.
// Web referensi: apps/game/src/renderer/npe.ts (STEPS identik).

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UE5NpeWidget.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnUE5NpeFinished);

UCLASS()
class UE5_API UUE5NpeWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	// Langkah NPE — judul SAMA dengan npe.ts.
	UPROPERTY(BlueprintReadOnly)
	int32 StepIndex = 0; // 0..4

	UPROPERTY(BlueprintReadOnly)
	bool bFinished = false;

	UPROPERTY(BlueprintAssignable)
	FOnUE5NpeFinished OnFinished;

	UFUNCTION(BlueprintCallable)
	void Start();

	UFUNCTION(BlueprintCallable)
	void Skip();

	// Dipanggil dari event gameplay: 0=Moved,1=Camera,2=Docked,3=Fired,4=Warped.
	UFUNCTION(BlueprintCallable)
	void ReportEvent(int32 StepId);

	// Event UMG editor: pindah step dengan fade 0.3s (bukan pop).
	UFUNCTION(BlueprintImplementableEvent)
	void OnStepChanged(int32 NewStepIndex);

	// Judul + hint tombol per step (index 0..4).
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FString StepTitle(int32 StepId);

	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FString StepKeyHint(int32 StepId);

private:
	void Advance();
};
