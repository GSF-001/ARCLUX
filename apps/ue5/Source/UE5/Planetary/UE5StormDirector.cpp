// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5StormDirector.h"

UUE5StormDirector::UUE5StormDirector()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UUE5StormDirector::ApplyEnvironment(const FUE5Environment& Env)
{
	if (Env.WeatherKind == LastKind) return;
	LastKind = Env.WeatherKind;
	OnWeatherChanged.Broadcast(LastKind);
}
