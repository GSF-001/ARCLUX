// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5PlanetaryReader.cpp — rumus IDENTIK TS (banded test: input sama → bit-sama).

#include "UE5PlanetaryReader.h"

namespace
{
	double Clamp01(double V) { return FMath::Clamp(V, 0.0, 1.0); }
	double Lerp(double A, double B, double T) { return A + (B - A) * T; }
}

FUE5GradeMood UUE5PlanetaryReader::DeriveGradeMood(double SunElevation, const FString& WeatherKind, const FString& TimeOfDay)
{
	FUE5GradeMood M;
	// Warm memuncak saat elevasi rendah di atas horizon (gradePass.ts:25).
	const double Warm = FMath::Max(0.0, 1.0 - FMath::Abs(SunElevation - 0.12) / 0.35) * (SunElevation > -0.05 ? 1.0 : 0.0);
	const double Storm = WeatherKind == TEXT("storm") ? 1.0 : (WeatherKind == TEXT("rain") ? 0.35 : 0.0);
	const double Night = TimeOfDay == TEXT("night") ? 1.0 : 0.0;
	M.Warm = Clamp01(Warm); M.Storm = Clamp01(Storm); M.Night = Clamp01(Night);
	return M;
}

FUE5CockpitState UUE5PlanetaryReader::DeriveCockpitState(double PrecipIntensity, double Accumulation,
	double CloudDensity, double CloudCoverage, double Haze, double Scattering,
	double AtmoDensity, double TerrainHeight, bool bLightningPeak, double LightningDist,
	bool bAtmoEntry, double CameraShake, double TimeSec)
{
	FUE5CockpitState S;
	const double FlashBase = (bLightningPeak) ? 1.0 - FMath::Min(1.0, LightningDist / 4200.0) : 0.0;
	S.FlashIntensity = Clamp01(FlashBase * (0.72 + PrecipIntensity * 0.28));
	S.WindshieldWet = Clamp01(PrecipIntensity * 0.82 + Accumulation * 0.12);
	S.DropletOpacity = Clamp01(S.WindshieldWet * (0.55 + PrecipIntensity * 0.32) + (S.FlashIntensity > 0.5 ? 0.08 : 0.0));
	const double Heat = FMath::Max(0.0, (AtmoDensity - 0.62) * 1.8) * (bAtmoEntry ? 1.4 : 0.22);
	S.HeatVignette = Clamp01(Heat * 0.52);
	S.CloudDim = Clamp01(CloudDensity * 0.42 + Haze * 0.22 + (CloudCoverage > 0.6 ? 0.12 : 0.0));
	const double TurbShake = CameraShake * 0.7;
	// Jam tick deterministik timeSec (pelajaran V8). Dijepit ±3px di konsumen.
	S.ShakeX = FMath::Sin(TimeSec * 9.0) * TurbShake * 1.8 + S.FlashIntensity * 0.6;
	S.ShakeY = FMath::Cos(TimeSec * 11.0) * TurbShake * 1.2 + S.HeatVignette * 0.4;
	S.ExposureOffset = Clamp01(S.FlashIntensity * 0.28 + S.HeatVignette * 0.12 + (1.0 - Scattering) * 0.06);
	(void)TerrainHeight;
	return S;
}

FUE5CockpitState UUE5PlanetaryReader::TickCockpit(const FUE5CockpitState& Prev, const FUE5CockpitState& Next, double Dt)
{
	const double A = 1.0 - FMath::Exp(-Dt * 4.2);
	const double FlashA = 1.0 - FMath::Exp(-Dt * 9.5);
	FUE5CockpitState S;
	S.WindshieldWet = Lerp(Prev.WindshieldWet, Next.WindshieldWet, A);
	S.DropletOpacity = Lerp(Prev.DropletOpacity, Next.DropletOpacity, A);
	S.FlashIntensity = Lerp(Prev.FlashIntensity, Next.FlashIntensity, FlashA);
	S.HeatVignette = Lerp(Prev.HeatVignette, Next.HeatVignette, A);
	S.CloudDim = Lerp(Prev.CloudDim, Next.CloudDim, A);
	S.ShakeX = Lerp(Prev.ShakeX, Next.ShakeX, A);
	S.ShakeY = Lerp(Prev.ShakeY, Next.ShakeY, A);
	S.ExposureOffset = Lerp(Prev.ExposureOffset, Next.ExposureOffset, A);
	return S;
}
