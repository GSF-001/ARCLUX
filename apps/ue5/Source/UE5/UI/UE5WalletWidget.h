// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5WalletWidget.h — Slice 5 06 §1.6: OC bottom corner, format koma ribuan,
// hologram muncul saat transaksi. Update saat OC berubah saja.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UE5WalletWidget.generated.h"

UCLASS()
class UE5_API UUE5WalletWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadOnly)
	int64 Oc = 0;

	UPROPERTY(BlueprintReadOnly)
	FString Display = TEXT("OC: 0");

	UFUNCTION(BlueprintCallable)
	void PushOc(int64 NewOc);

	// Mirror 06 §1.3: "OC: 1,250,000".
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FString FormatOc(int64 Value);

	// UMG editor: hologram fade saat OC berubah.
	UFUNCTION(BlueprintImplementableEvent)
	void OnOcChanged(int64 NewOc);
};
