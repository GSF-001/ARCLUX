// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5LightRigActor.h"
#include "Components/DirectionalLightComponent.h"

AUE5LightRigActor::AUE5LightRigActor()
{
	PrimaryActorTick.bCanEverTick = false;
	KeyLight = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("KeyLight"));
	SetRootComponent(KeyLight);
	FillLight = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("FillLight"));
	FillLight->SetupAttachment(KeyLight);
	RimLight = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("RimLight"));
	RimLight->SetupAttachment(KeyLight);
	KeyLight->SetIntensity(2.5f);
	RimLight->SetIntensity(1.5f);
	FillLight->SetIntensity(0.4f);
}

void AUE5LightRigActor::BeginPlay()
{
	Super::BeginPlay();
}

void AUE5LightRigActor::ApplyEnvironment(const FUE5Environment& Env)
{
	RefreshLightRotations(Env.SunElevation);
	// FUE5Environment tidak bawa sun.intensity — turunkan dari elevation (rad):
	// siang penuh di zenith (~1.3 rad) → 1, di bawah horizon → 0 (malam).
	const double Elev = Env.SunElevation;
	const double I = FMath::Clamp(FMath::Sin(FMath::Max(0.0, Elev)) * (1.0 / FMath::Sin(1.3)), 0.0, 1.0);
	ApplySunIntensity(I);
}

void AUE5LightRigActor::ApplySunIntensity(double SunIntensity)
{
	// lighting.ts: key = intensity*2.5, rim 0.6x key (lighting.ts:90).
	KeyLight->SetIntensity(static_cast<float>(SunIntensity * 2.5));
	RimLight->SetIntensity(static_cast<float>(SunIntensity * 2.5 * 0.6));
	FillLight->SetIntensity(0.4f);
}

void AUE5LightRigActor::RefreshLightRotations(double SunElevationRad)
{
	// key menghadap berlawanan arah sun (datang dari posisi sun).
	KeyLight->SetRelativeRotation(FRotator(-FMath::RadiansToDegrees(SunElevationRad), 0.0, 0.0));
	RimLight->SetRelativeRotation(FRotator(-FMath::RadiansToDegrees(SunElevationRad), 180.0, 0.0));
	FillLight->SetRelativeRotation(FRotator(45.0, 90.0, 0.0));
}
