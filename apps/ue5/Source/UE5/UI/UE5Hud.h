// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5Hud.h — HUD KONTEKSTUAL (06 §2.6): Idle kosong / Scan on-demand / Combat full.
// Update HANYA saat state berubah (hash-guard pola hud.ts:95). Visual UMG
// (layout TAC-kiri/VESSEL-kanan/slot-bawah + token) dibikin di editor PC;
// class ini mesin state-nya. Melebihi hud.ts: auto-hide combat 3s + mode state.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "UE5Hud.generated.h"

// Mode HUD (bukan selalu ON — semua panel ON = amatir).
UENUM(BlueprintType)
enum class EUE5HudMode : uint8
{
	Idle    UMETA(DisplayName = "IDLE"),   // crosshair + speed + compass saja
	Scan    UMETA(DisplayName = "SCAN"),   // + TAC kiri + target + radar
	Combat  UMETA(DisplayName = "COMBAT")  // full: slot + vessel + misi
};

UCLASS()
class UE5_API UUE5Hud : public UUserWidget
{
	GENERATED_BODY()

public:
	// State tampil (Blueprint baca untuk show/hide panel).
	UPROPERTY(BlueprintReadOnly)
	EUE5HudMode HudMode = EUE5HudMode::Idle;

	UPROPERTY(BlueprintReadOnly)
	int64 LastTick = -1;

	UPROPERTY(BlueprintReadOnly)
	int32 Hull = 100;

	UPROPERTY(BlueprintReadOnly)
	double Speed = 0; // m/s

	UPROPERTY(BlueprintReadOnly)
	int32 SelectedSlot = 0; // 1..4 (inventori 06 §4.5)

	// Dipanggil tiap OnSnapshot. NOL update UMG bila hash sama (pola hud.ts).
	UFUNCTION(BlueprintCallable)
	void PushState(int64 Tick, int32 InHull, double InSpeed, bool bThreat);

	// Hold/toggle TAC (Scan on demand). Combat auto-hide 3 detik tanpa threat.
	UFUNCTION(BlueprintCallable)
	void SetScanHeld(bool bHeld);

	UFUNCTION(BlueprintCallable)
	void SelectSlot(int32 Slot); // 1..4

	// Event untuk UMG editor (fade/scan 0.3s, bukan pop).
	UFUNCTION(BlueprintImplementableEvent)
	void OnHudModeChanged(EUE5HudMode NewMode);

protected:
	virtual void NativeConstruct() override;

private:
	bool bScanHeld = false;
	bool bThreatNow = false;
	uint32 LastHash = 0;
	FTimerHandle CombatHideTimer;
	void RecomputeMode();
	void OnCombatTimeout();
};
