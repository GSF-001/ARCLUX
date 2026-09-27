// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5PlanetaryReader.h — fungsi MURNI testable (pola resolver TS).
// RUMUS IDENTIK dengan gradePass.ts deriveGradeMood +
// CockpitResponseResolver.ts deriveCockpitState/tickCockpit.
// Ubah rumus = dua client beda perilaku = bug MMO (00-migrasi.md §5).

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "UE5PlanetaryReader.generated.h"

// GradeMood 0..1 (mirror gradePass.ts:16).
USTRUCT(BlueprintType)
struct FUE5GradeMood
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Warm = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Storm = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Night = 0;
};

// CockpitState (mirror CockpitResponseResolver.ts:11). Shake ±px di konsumen.
USTRUCT(BlueprintType)
struct FUE5CockpitState
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double WindshieldWet = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double DropletOpacity = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double FlashIntensity = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double HeatVignette = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double CloudDim = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double ShakeX = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double ShakeY = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double ExposureOffset = 0;
};

UCLASS()
class UE5_API UUE5PlanetaryReader : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	// Mirror gradePass.ts:22. elev = sun.elevation, kind = weather.kind, tod = timeOfDay.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FUE5GradeMood DeriveGradeMood(double SunElevation, const FString& WeatherKind, const FString& TimeOfDay);

	// Mirror CockpitResponseResolver.ts:24. timeSec = jam tick deterministik (BUKAN Date.now).
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FUE5CockpitState DeriveCockpitState(double PrecipIntensity, double Accumulation,
		double CloudDensity, double CloudCoverage, double Haze, double Scattering,
		double AtmoDensity, double TerrainHeight, bool bLightningPeak, double LightningDist,
		bool bAtmoEntry, double CameraShake, double TimeSec);

	// Mirror tickCockpit (smoothing exp). Dipanggil tiap frame render.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FUE5CockpitState TickCockpit(const FUE5CockpitState& Prev, const FUE5CockpitState& Next, double Dt);
};
