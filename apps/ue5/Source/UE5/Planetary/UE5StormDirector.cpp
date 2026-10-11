// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5StormDirector.h"
#include "Cinematic/UE5CinematicDirector.h"

UUE5StormDirector::UUE5StormDirector()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UUE5StormDirector::ApplyEnvironment(const FUE5Environment& Env)
{
	// Slice 7: cinematic butuh feed SETIAP env update (precip/wind untuk
	// intensity), bukan hanya saat kind berubah. Visibility: FUE5Environment
	// belum bawa field-nya — default TS 10000m (env.atmosphere.visibility).
	if (CinematicDirector)
	{
		CinematicDirector->FeedEnvironment(Env.WeatherKind, Env.Precipitation, Env.Wind, 10000.0);
	}
	if (Env.WeatherKind == LastKind) return;
	LastKind = Env.WeatherKind;
	OnWeatherChanged.Broadcast(LastKind);
}
