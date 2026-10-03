// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5StormDirector.h — Slice 3: trigger sinkron atmosfer. Presentation only.
// Input: FUE5Environment dari snapshot/server. Output: delegate OnWeatherChanged.
// Rantai CLEAR->OVERCAST->RAIN->STORM = mirror apps/game weather state machine
// (jangan ubah urutan — dua client harus sama).

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UE5Types.h"
#include "UE5StormDirector.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnUE5WeatherChanged, const FString&, WeatherKind);

UCLASS(ClassGroup = (ARCLUX), meta = (BlueprintSpawnableComponent))
class UE5_API UUE5StormDirector : public UActorComponent
{
	GENERATED_BODY()

public:
	UUE5StormDirector();

	UPROPERTY(BlueprintAssignable)
	FOnUE5WeatherChanged OnWeatherChanged;

	// Terapkan FUE5Environment terbaru dari server. Broadcast hanya saat berubah.
	UFUNCTION(BlueprintCallable)
	void ApplyEnvironment(const FUE5Environment& Env);

	// True bila server mengirim kind storm/rain (trigger Niagara di Slice 3).
	UFUNCTION(BlueprintPure)
	bool IsStorm() const { return LastKind == TEXT("storm"); }

	UFUNCTION(BlueprintPure)
	bool IsPrecip() const { return LastKind == TEXT("rain") || IsStorm(); }

private:
	FString LastKind;
};
