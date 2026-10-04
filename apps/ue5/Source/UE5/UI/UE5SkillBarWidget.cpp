// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5SkillBarWidget.h"

TArray<FString> UUE5SkillBarWidget::SkillNames(EUE5ActiveMode Mode)
{
	if (Mode == EUE5ActiveMode::Fps)
	{
		return { TEXT("COMBAT"), TEXT("STEALTH"), TEXT("SURVIVAL"), TEXT("TECHNICAL") };
	}
	return { TEXT("ENGINE"), TEXT("WEAPONS"), TEXT("SHIELD"), TEXT("NAV") };
}

void UUE5SkillBarWidget::SetActiveMode(EUE5ActiveMode Mode)
{
	if (Mode == ActiveMode) return;
	ActiveMode = Mode;
	Slots = SkillNames(Mode);
	OnModeSwapped(Mode);
}

void UUE5SkillBarWidget::SetVisibleForContext(bool bScanOrCombat)
{
	bVisible = bScanOrCombat;
	Slots = SkillNames(ActiveMode);
}
