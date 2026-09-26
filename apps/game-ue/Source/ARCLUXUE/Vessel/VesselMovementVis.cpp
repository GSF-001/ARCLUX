// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// VesselMovementVis.cpp — interpolasi linear deterministik antar snapshot.

#include "VesselMovementVis.h"

void UVesselMovementVis::PushSnapshot(const FArcluxVec3& Pos, const FArcluxVec3& Vel, int64 Tick)
{
	PrevPos = CurrPos; PrevTick = CurrTick; PrevTimeSec = CurrTimeSec;
	CurrPos = Pos; CurrVel = Vel; CurrTick = Tick;
	CurrTimeSec = FPlatformTime::Seconds();
	if (PrevTick < 0) { PrevPos = CurrPos; PrevTick = CurrTick; PrevTimeSec = CurrTimeSec; }
}

FArcluxVec3 UVesselMovementVis::SamplePosition(double NowSec) const
{
	const double Span = FMath::Max(0.0001, CurrTimeSec - PrevTimeSec);
	const double Alpha = FMath::Clamp((NowSec - PrevTimeSec) / Span, 0.0, 1.0);
	FArcluxVec3 Out;
	Out.X = PrevPos.X + (CurrPos.X - PrevPos.X) * Alpha;
	Out.Y = PrevPos.Y + (CurrPos.Y - PrevPos.Y) * Alpha;
	Out.Z = PrevPos.Z + (CurrPos.Z - PrevPos.Z) * Alpha;
	return Out;
}
