// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5HeatWidget.h"

FString UUE5HeatWidget::WantedColorToken(int32 InWantedLevel)
{
	if (InWantedLevel <= 0) return TEXT("ok");
	if (InWantedLevel <= 2) return TEXT("warn");
	return TEXT("danger");
}

void UUE5HeatWidget::PushState(int32 InWantedLevel, bool bInBodycamOn, bool bInTetherWarning)
{
	const int32 Clamped = FMath::Clamp(InWantedLevel, 0, 5);
	if (Clamped == WantedLevel && bInBodycamOn == bBodycamOn && bInTetherWarning == bTetherWarning) return;
	WantedLevel = Clamped;
	bBodycamOn = bInBodycamOn;
	bTetherWarning = bInTetherWarning;
}
