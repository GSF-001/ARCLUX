// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5InteriorWidget.h — Slice 2 placeholder interior (gate: fly→dock→interior no-crash).
// Interior full (promenade/plaza/habitat — port interior.ts) = Slice 5.
// Widget ini hanya: nama stasiun + status docked + tombol Depart (lokal).

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UE5InteriorWidget.generated.h"

UCLASS()
class UE5_API UUE5InteriorWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadOnly)
	FString StationName;

	UPROPERTY(BlueprintReadOnly)
	bool bDocked = false;

	UFUNCTION(BlueprintCallable)
	void ShowDocked(const FString& InStationName);

	// Depart = tutup widget (lokal). Undock fisik = intent move (server lepas otomatis).
	UFUNCTION(BlueprintCallable)
	void Depart();

	UFUNCTION(BlueprintImplementableEvent)
	void OnDocked();

	UFUNCTION(BlueprintImplementableEvent)
	void OnDeparted();
};
