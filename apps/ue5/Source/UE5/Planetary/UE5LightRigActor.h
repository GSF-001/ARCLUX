// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5LightRigActor.h — Slice 3 L1: key/fill/rim mirror lighting.ts.
// Arah sun dari sun.elevation (FUE5Environment), intensitas dasar
// envContext.sun.intensity * 2.5 (lighting.ts:121). Presentasi saja.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "UE5Types.h"
#include "UE5LightRigActor.generated.h"

UCLASS()
class UE5_API AUE5LightRigActor : public AActor
{
	GENERATED_BODY()

public:
	AUE5LightRigActor();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class UDirectionalLightComponent* KeyLight;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class UDirectionalLightComponent* FillLight;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	class UDirectionalLightComponent* RimLight;

	UFUNCTION(BlueprintCallable)
	void ApplyEnvironment(const FUE5Environment& Env);

	// Intensitas dasar mirror lighting.ts: key = intensity*2.5, rim = 0.6x key.
	UFUNCTION(BlueprintCallable)
	void ApplySunIntensity(double SunIntensity);

protected:
	virtual void BeginPlay() override;

private:
	void RefreshLightRotations(double SunElevationDeg);
};
