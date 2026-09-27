// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5InteriorWidget.cpp — placeholder. Visual UMG di editor PC.

#include "UE5InteriorWidget.h"

void UUE5InteriorWidget::ShowDocked(const FString& InStationName)
{
	StationName = InStationName;
	bDocked = true;
	AddToViewport();
	OnDocked();
}

void UUE5InteriorWidget::Depart()
{
	bDocked = false;
	RemoveFromParent();
	OnDeparted();
}
