// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5CinematicDirector.h — Slice 7: cinematic event director di UE5.
// Port 1:1 dari scene3d/cinematic/CinematicEventDirector.ts +
// wireC.ts updateTriggers (rumus/durasi/prioritas IDENTIK — dua client
// beda perilaku = bug MMO, 00-migrasi.md §5).
//
// Peran: CODE (10%), bukan asset (90%). Director HANYA memutuskan KAPAN
// event cinematic aktif dan fase apa; kamera/sequence/shake yang tampil
// adalah asset lo di editor (mapping per event type). Server kirim state
// (snapshot + env), director menerjemahkan ke fase — presentation only,
// tidak pernah menulis gameplay state.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UE5CinematicDirector.generated.h"

// Event cinematic (mirror CinematicEventType — 7 tipe).
UENUM(BlueprintType)
enum class EUE5CinematicEventType : uint8
{
	AtmosphericEntry,
	Storm,
	Lightning,
	EmergencyLanding,
	Landing,
	Crash,
	Docking,
};

// Fase (mirror CinematicPhase — schedule fraksi durasi, wireC.ts).
UENUM(BlueprintType)
enum class EUE5CinematicPhase : uint8
{
	Trigger,
	Pre,
	Active,
	Peak,
	Recovery,
	Exit,
};

// Kamera grammar per fase (mirror CAMERA_GRAMMAR — string sama dengan TS:
// consumer level BP/Sequence match nama ini).
UENUM(BlueprintType)
enum class EUE5CameraMode : uint8
{
	Stable,
	Follow,
	CloudCompression,
	Reveal,
	Approach,
	Touchdown,
	Impact,
	Displace,
	Settle,
};

// Konteks pemenang per tick (mirror CinematicContext.ts — field yang
// sama; exposure/visibility/intensity di-derive dari env snapshot).
USTRUCT(BlueprintType)
struct FUE5_API FUE5CinematicContext
{
	GENERATED_BODY()
	UPROPERTY(BlueprintReadOnly) FString EventId;
	UPROPERTY(BlueprintReadOnly) EUE5CinematicEventType EventType = EUE5CinematicEventType::Storm;
	UPROPERTY(BlueprintReadOnly) EUE5CinematicPhase Phase = EUE5CinematicPhase::Exit;
	UPROPERTY(BlueprintReadOnly) int32 Priority = 0;
	UPROPERTY(BlueprintReadOnly) EUE5CameraMode CameraMode = EUE5CameraMode::Stable;
	UPROPERTY(BlueprintReadOnly) double Exposure = 0;        // additive stops, cap 0.3
	UPROPERTY(BlueprintReadOnly) double Visibility = 10000;  // meter
	UPROPERTY(BlueprintReadOnly) double EnvironmentalIntensity = 0; // 0..1
	UPROPERTY(BlueprintReadOnly) double AudioIntensity = 0;          // 0..1
	UPROPERTY(BlueprintReadOnly) double TransitionProgress = 0;      // 0..1 dalam fase
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnUE5CinematicPhase, const FUE5CinematicContext&, Context);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnUE5CinematicEnded, EUE5CinematicEventType, EventType);

UCLASS(ClassGroup = (ARCLUX), meta = (BlueprintSpawnableComponent))
class UE5_API UUE5CinematicDirector : public UActorComponent
{
	GENERATED_BODY()

public:
	UUE5CinematicDirector();

	// Pemenang fase berubah — consumer (level BP) tukar Sequence/kamera dari
	// sini. Assignment asset = urusan editor; director cuma kasih konteks.
	UPROPERTY(BlueprintAssignable)
	FOnUE5CinematicPhase OnPhaseChanged;

	UPROPERTY(BlueprintAssignable)
	FOnUE5CinematicEnded OnEventEnded;

	// Feed env dari PlanetaryReader/StormDirector (weather.kind TS: "storm" etc).
	UFUNCTION(BlueprintCallable)
	void FeedEnvironment(const FString& WeatherKind, double PrecipitationIntensity,
		double WindSpeed, double AtmosphereVisibility);

	// Feed status kapal lokal per tick (mirror updateTriggers opts: altitude,
	// speed, emergency state dari snapshot vessel — wireC.ts:123).
	UFUNCTION(BlueprintCallable)
	void FeedVesselState(double Altitude, double SpeedMps, const FString& EmergencyState);

	// Event server eksplisit (collision/cosmic dari /events — Slice 8 bila ada).
	UFUNCTION(BlueprintCallable)
	void NotifyServerEvent(const FString& ServerEventType);

	// Advance fase (panggil tiap frame render, dt detik).
	UFUNCTION(BlueprintCallable)
	void TickDirector(float Dt);

	// Pemenang sekarang (nullptr = tidak ada event live).
	UFUNCTION(BlueprintCallable, BlueprintPure)
	bool GetCurrentContext(FUE5CinematicContext& OutContext) const;

	UFUNCTION(BlueprintCallable, BlueprintPure)
	bool HasEvent(EUE5CinematicEventType Type) const;

	// Port dari wireC.ts updateTriggers — trigger/cancel deterministik.
	void UpdateTriggers(double Altitude, double SpeedMps, const FString& EmergencyState);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	struct FActiveEvent
	{
		FString EventId;
		EUE5CinematicEventType Type;
		int32 Priority;
		double StartedAtSec;   // clock director (akumulasi Dt)
		double DurationSec;
	};

	TArray<FActiveEvent> Active;
	double ClockSec = 0;
	int32 Seq = 0;

	// snapshot env terakhir (untuk derive intensity/exposure).
	FString WeatherKind = TEXT("clear");
	double Precip = 0;
	double Wind = 0;
	double Visibility = 10000;

	double PrevAltitude = -1.0;
	FString PrevEmergency;

	// dedup broadcast OnPhaseChanged (fase berubah saja).
	FString LastEventId;
	EUE5CinematicPhase LastPhase = EUE5CinematicPhase::Exit;

	void Trigger(EUE5CinematicEventType Type, double DurationSec);
	void Cancel(EUE5CinematicEventType Type);
	FUE5CinematicContext DeriveContext(const FActiveEvent& Ev, EUE5CinematicPhase Phase, double Progress) const;
	static EUE5CinematicPhase PhaseFor(double Progress);
	static EUE5CameraMode CameraModeFor(EUE5CinematicEventType Type, EUE5CinematicPhase Phase);
	static int32 PriorityFor(EUE5CinematicEventType Type);
	static const TCHAR* EventTypeToString(EUE5CinematicEventType Type);
};
