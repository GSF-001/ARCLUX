// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5Hud.cpp — mesin mode HUD. Combat penuh hanya situasional.

#include "UE5Hud.h"

void UUE5Hud::NativeConstruct()
{
	Super::NativeConstruct();
}

void UUE5Hud::PushState(int64 Tick, int32 InHull, double InSpeed, bool bThreat)
{
	// Hash-guard: angka sama = tidak ada update UMG (hemat, pola hud.ts:95).
	uint32 H = HashCombine(HashCombine(::GetTypeHash(Tick), ::GetTypeHash(InHull)),
		HashCombine(::GetTypeHash(InSpeed), bThreat ? 1u : 0u));
	LastTick = Tick;
	bThreatNow = bThreat;
	if (H == LastHash) return;
	LastHash = H;
	Hull = InHull;
	Speed = InSpeed;
	RecomputeMode();
}

void UUE5Hud::SetScanHeld(bool bHeld)
{
	bScanHeld = bHeld;
	RecomputeMode();
}

void UUE5Hud::SelectSlot(int32 Slot)
{
	if (Slot >= 1 && Slot <= 4) SelectedSlot = Slot; // batas keras 06 §4.5
}

void UUE5Hud::RecomputeMode()
{
	EUE5HudMode Want = EUE5HudMode::Idle;
	if (bThreatNow) Want = EUE5HudMode::Combat;
	else if (bScanHeld) Want = EUE5HudMode::Scan;

	if (Want != HudMode)
	{
		HudMode = Want;
		OnHudModeChanged(HudMode);
	}
	if (HudMode == EUE5HudMode::Combat && !bThreatNow)
	{
		// Pengaman: keluar combat 3 detik tanpa threat (06 §2.6).
		GetWorld()->GetTimerManager().SetTimer(CombatHideTimer, this,
			&UUE5Hud::OnCombatTimeout, 3.0f, false);
	}
}

void UUE5Hud::OnCombatTimeout()
{
	if (!bThreatNow) RecomputeMode();
}
