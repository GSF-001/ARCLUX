// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5CinematicDirector.cpp — Slice 7. Rumus IDENTIK dengan CinematicEventDirector.ts
// + wireC.ts updateTriggers (00-migrasi.md §5: dua client beda = bug MMO).
// Presentation only — tidak baca/tulis gameplay state.

#include "UE5CinematicDirector.h"

// Mirror wireC.ts konstanta trigger.
static constexpr double ENTRY_ALTITUDE = 2500;
static constexpr double ENTRY_SPEED = 40;
static constexpr double LANDING_ALTITUDE = 50;
static constexpr double DEFAULT_DURATION_SEC = 8.0; // director.ts duration=8000ms
static constexpr double CRASH_DURATION_SEC = 10.0;   // wireC trigger(..., 10000)
static constexpr double LANDING_DURATION_SEC = 6.0;  // wireC trigger(..., 6000)

// Mirror PHASE_EDGES (CinematicEventDirector.ts:16).
static constexpr double PHASE_EDGES[] = { 0.12, 0.25, 0.55, 0.75, 0.92 };
static constexpr EUE5CinematicPhase PHASE_ORDER[] = {
	EUE5CinematicPhase::Trigger, EUE5CinematicPhase::Pre, EUE5CinematicPhase::Active,
	EUE5CinematicPhase::Peak, EUE5CinematicPhase::Recovery, EUE5CinematicPhase::Exit,
};

UUE5CinematicDirector::UUE5CinematicDirector()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UUE5CinematicDirector::BeginPlay()
{
	Super::BeginPlay();
}

void UUE5CinematicDirector::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	Active.Reset();
	Super::EndPlay(EndPlayReason);
}

// Mirror EVENT_PRIORITY (CinematicContext.ts:53) — higher preempts lower.
int32 UUE5CinematicDirector::PriorityFor(EUE5CinematicEventType Type)
{
	switch (Type)
	{
	case EUE5CinematicEventType::Crash: return 100;
	case EUE5CinematicEventType::EmergencyLanding: return 90;
	case EUE5CinematicEventType::AtmosphericEntry: return 70;
	case EUE5CinematicEventType::Lightning: return 65;
	case EUE5CinematicEventType::Storm: return 50;
	case EUE5CinematicEventType::Landing: return 45;
	case EUE5CinematicEventType::Docking: return 30;
	default: return 50;
	}
}

// Mirror CAMERA_GRAMMAR (CinematicContext.ts:60).
EUE5CameraMode UUE5CinematicDirector::CameraModeFor(EUE5CinematicEventType Type, EUE5CinematicPhase Phase)
{
	switch (Type)
	{
	case EUE5CinematicEventType::AtmosphericEntry:
		switch (Phase)
		{
		case EUE5CinematicPhase::Trigger: return EUE5CameraMode::Stable;
		case EUE5CinematicPhase::Pre: return EUE5CameraMode::Follow;
		case EUE5CinematicPhase::Active:
		case EUE5CinematicPhase::Peak: return EUE5CameraMode::CloudCompression;
		case EUE5CinematicPhase::Recovery: return EUE5CameraMode::Reveal;
		default: return EUE5CameraMode::Stable;
		}
	case EUE5CinematicEventType::Storm:
	case EUE5CinematicEventType::Lightning:
		switch (Phase)
		{
		case EUE5CinematicPhase::Active:
		case EUE5CinematicPhase::Peak:
			return Type == EUE5CinematicEventType::Lightning ? EUE5CameraMode::Reveal : EUE5CameraMode::Follow;
		case EUE5CinematicPhase::Pre: return EUE5CameraMode::Follow;
		case EUE5CinematicPhase::Recovery: return Type == EUE5CinematicEventType::Storm ? EUE5CameraMode::Reveal : EUE5CameraMode::Stable;
		default: return EUE5CameraMode::Stable;
		}
	case EUE5CinematicEventType::Crash:
		switch (Phase)
		{
		case EUE5CinematicPhase::Trigger:
		case EUE5CinematicPhase::Pre: return EUE5CameraMode::Follow;
		case EUE5CinematicPhase::Active: return EUE5CameraMode::Impact;
		case EUE5CinematicPhase::Peak: return EUE5CameraMode::Displace;
		case EUE5CinematicPhase::Recovery: return EUE5CameraMode::Settle;
		default: return EUE5CameraMode::Stable;
		}
	// EMERGENCY_LANDING / LANDING / DOCKING — grammar identik di TS.
	default:
		switch (Phase)
		{
		case EUE5CinematicPhase::Trigger: return EUE5CameraMode::Follow;
		case EUE5CinematicPhase::Pre:
		case EUE5CinematicPhase::Active: return EUE5CameraMode::Approach;
		case EUE5CinematicPhase::Peak: return EUE5CameraMode::Touchdown;
		case EUE5CinematicPhase::Recovery: return EUE5CameraMode::Settle;
		default: return EUE5CameraMode::Stable;
		}
	}
}

// Mirror phaseFor (CinematicEventDirector.ts:35) — fraksi durasi.
EUE5CinematicPhase UUE5CinematicDirector::PhaseFor(double Progress)
{
	for (int32 i = 0; i < UE_ARRAY_COUNT(PHASE_EDGES); ++i)
	{
		if (Progress < PHASE_EDGES[i]) return PHASE_ORDER[i];
	}
	return EUE5CinematicPhase::Exit;
}

const TCHAR* UUE5CinematicDirector::EventTypeToString(EUE5CinematicEventType Type)
{
	switch (Type)
	{
	case EUE5CinematicEventType::AtmosphericEntry: return TEXT("ATMOSPHERIC_ENTRY");
	case EUE5CinematicEventType::Storm: return TEXT("STORM");
	case EUE5CinematicEventType::Lightning: return TEXT("LIGHTNING");
	case EUE5CinematicEventType::EmergencyLanding: return TEXT("EMERGENCY_LANDING");
	case EUE5CinematicEventType::Landing: return TEXT("LANDING");
	case EUE5CinematicEventType::Crash: return TEXT("CRASH");
	case EUE5CinematicEventType::Docking: return TEXT("DOCKING");
	default: return TEXT("UNKNOWN");
	}
}

void UUE5CinematicDirector::FeedEnvironment(const FString& InWeatherKind, double InPrecip,
	double InWind, double InVisibility)
{
	WeatherKind = InWeatherKind;
	Precip = InPrecip;
	Wind = InWind;
	Visibility = InVisibility;

	// Mirror wireC.ts:136 — storm ikut cuaca, bukan status kapal.
	if (WeatherKind == TEXT("storm"))
	{
		if (!HasEvent(EUE5CinematicEventType::Storm)) Trigger(EUE5CinematicEventType::Storm, DEFAULT_DURATION_SEC);
	}
	else
	{
		Cancel(EUE5CinematicEventType::Storm);
	}
}

// Mirror updateTriggers (wireC.ts:123) — deterministik dari state yang di-feed.
void UUE5CinematicDirector::UpdateTriggers(double Altitude, double SpeedMps, const FString& EmergencyState)
{
	if (EmergencyState != PrevEmergency)
	{
		if (EmergencyState == TEXT("falling") && !HasEvent(EUE5CinematicEventType::EmergencyLanding))
		{
			Trigger(EUE5CinematicEventType::EmergencyLanding, DEFAULT_DURATION_SEC);
		}
		if (EmergencyState == TEXT("crashed") && !HasEvent(EUE5CinematicEventType::Crash))
		{
			Trigger(EUE5CinematicEventType::Crash, CRASH_DURATION_SEC);
		}
	}
	PrevEmergency = EmergencyState;

	if (PrevAltitude >= 0)
	{
		const bool bWasAboveEntry = PrevAltitude > ENTRY_ALTITUDE;
		if (bWasAboveEntry && Altitude <= ENTRY_ALTITUDE && SpeedMps > ENTRY_SPEED)
		{
			if (!HasEvent(EUE5CinematicEventType::AtmosphericEntry)) Trigger(EUE5CinematicEventType::AtmosphericEntry, DEFAULT_DURATION_SEC);
		}
		const bool bWasAboveGround = PrevAltitude >= LANDING_ALTITUDE;
		if (bWasAboveGround && Altitude < LANDING_ALTITUDE && SpeedMps < 25)
		{
			if (!HasEvent(EUE5CinematicEventType::Landing)) Trigger(EUE5CinematicEventType::Landing, LANDING_DURATION_SEC);
		}
	}
	PrevAltitude = Altitude;
}

void UUE5CinematicDirector::FeedVesselState(double Altitude, double SpeedMps, const FString& EmergencyState)
{
	UpdateTriggers(Altitude, SpeedMps, EmergencyState);
}

void UUE5CinematicDirector::NotifyServerEvent(const FString& ServerEventType)
{
	// Event server eksplisit → tipe cinematic yang sama namanya.
	if (ServerEventType == TEXT("LIGHTNING")) Trigger(EUE5CinematicEventType::Lightning, DEFAULT_DURATION_SEC);
	else if (ServerEventType == TEXT("DOCKING")) Trigger(EUE5CinematicEventType::Docking, DEFAULT_DURATION_SEC);
	else if (ServerEventType == TEXT("CRASH")) Trigger(EUE5CinematicEventType::Crash, CRASH_DURATION_SEC);
	else if (ServerEventType == TEXT("EMERGENCY_LANDING")) Trigger(EUE5CinematicEventType::EmergencyLanding, DEFAULT_DURATION_SEC);
}

void UUE5CinematicDirector::Trigger(EUE5CinematicEventType Type, double DurationSec)
{
	// Idempoten — trigger saat sudah aktif = perpanjang (TS: trigger selalu
	// buat id baru; di sini updateTriggers selalu di-guard HasEvent, jadi
	// jalur ini hanya untuk feed eksplisit).
	for (const FActiveEvent& Ev : Active)
	{
		if (Ev.Type == Type) return;
	}
	FActiveEvent Ev;
	Ev.EventId = FString::Printf(TEXT("cin-%s-%d-%d"), EventTypeToString(Type), FMath::FloorToInt32(ClockSec * 1000), ++Seq);
	Ev.Type = Type;
	Ev.Priority = PriorityFor(Type);
	Ev.StartedAtSec = ClockSec;
	Ev.DurationSec = DurationSec;
	Active.Add(Ev);
}

void UUE5CinematicDirector::Cancel(EUE5CinematicEventType Type)
{
	Active.RemoveAll([Type](const FActiveEvent& Ev) { return Ev.Type == Type; });
}

bool UUE5CinematicDirector::HasEvent(EUE5CinematicEventType Type) const
{
	for (const FActiveEvent& Ev : Active)
	{
		if (Ev.Type == Type) return true;
	}
	return false;
}

// Mirror deriveCinematicContext (CinematicContext.ts:91) — envIntensity,
// exposure cap 0.3, audioIntensity. Peak boost saat fase Peak.
FUE5CinematicContext UUE5CinematicDirector::DeriveContext(const FActiveEvent& Ev,
	EUE5CinematicPhase Phase, double Progress) const
{
	const double EnvIntensity = FMath::Clamp(
		Precip * 0.5 + Wind * 0.05 + (1.0 - Visibility / 10000.0) * 0.3, 0.0, 1.0);
	const double PeakBoost = Phase == EUE5CinematicPhase::Peak ? 1.0 : 0.0;

	FUE5CinematicContext Ctx;
	Ctx.EventId = Ev.EventId;
	Ctx.EventType = Ev.Type;
	Ctx.Phase = Phase;
	Ctx.Priority = Ev.Priority;
	Ctx.CameraMode = CameraModeFor(Ev.Type, Phase);
	Ctx.Exposure = FMath::Min(0.3, EnvIntensity * 0.25 + PeakBoost * 0.15);
	Ctx.Visibility = Visibility;
	Ctx.EnvironmentalIntensity = EnvIntensity;
	Ctx.AudioIntensity = FMath::Clamp(EnvIntensity * 0.8 + PeakBoost * 0.2, 0.0, 1.0);
	Ctx.TransitionProgress = Progress;
	return Ctx;
}

// Mirror director.tick (CinematicEventDirector.ts:85) — expiry + pemenang
// prioritas tertinggi; CRASH (100) tak pernah tergusur event lebih rendah.
void UUE5CinematicDirector::TickDirector(float Dt)
{
	ClockSec += Dt;

	for (int32 i = Active.Num() - 1; i >= 0; --i)
	{
		const double Elapsed = ClockSec - Active[i].StartedAtSec;
		if (Elapsed >= Active[i].DurationSec)
		{
			OnEventEnded.Broadcast(Active[i].Type);
			Active.RemoveAt(i);
		}
	}

	if (Active.Num() == 0) return;

	const FActiveEvent* Best = nullptr;
	for (const FActiveEvent& Ev : Active)
	{
		if (!Best || Ev.Priority > Best->Priority) Best = &Ev;
	}
	if (!Best) return;

	const double Progress = (ClockSec - Best->StartedAtSec) / Best->DurationSec;
	const EUE5CinematicPhase Phase = PhaseFor(Progress);
	// Broadcast hanya saat fase berubah (seperti TS: re-derive tiap tick,
	// consumer bandingkan phase untuk tukar shot).
	if (LastEventId != Best->EventId || LastPhase != Phase)
	{
		LastEventId = Best->EventId;
		LastPhase = Phase;
		OnPhaseChanged.Broadcast(DeriveContext(*Best, Phase, Progress));
	}
}

bool UUE5CinematicDirector::GetCurrentContext(FUE5CinematicContext& OutContext) const
{
	const FActiveEvent* Best = nullptr;
	for (const FActiveEvent& Ev : Active)
	{
		if (!Best || Ev.Priority > Best->Priority) Best = &Ev;
	}
	if (!Best) return false;
	const double Progress = (ClockSec - Best->StartedAtSec) / Best->DurationSec;
	OutContext = DeriveContext(*Best, PhaseFor(Progress), Progress);
	return true;
}
