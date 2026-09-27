// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5IntentFactory.cpp — mirror bit-akurat input.ts sendMove.

#include "UE5IntentFactory.h"

FUE5Intent UUE5IntentFactory::BuildMoveIntent(const FString& PlayerId, const FString& EntityId,
	double CurX, double CurY, double CurZ,
	double DirX, double DirY, double DirZ,
	bool bBoost, bool bBrake, int64 Seq)
{
	FUE5Intent Intent;
	Intent.PlayerId = PlayerId;
	Intent.EntityId = EntityId;
	Intent.Type = TEXT("move"); // key SAMA dengan TS
	Intent.Seq = Seq;
	if (bBrake && !bBoost)
	{
		// Brake → target = posisi sendiri (server: jarak<1 → reverse thrust).
		Intent.PayloadJson = FString::Printf(TEXT("{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f}"), CurX, CurY, CurZ);
	}
	else
	{
		const double BF = bBoost ? BoostFactor : 1.0;
		Intent.PayloadJson = FString::Printf(TEXT("{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f}"),
			CurX + DirX * MoveStep * BF,
			CurY + DirY * MoveStep * BF,
			CurZ + DirZ * MoveStep * BF);
	}
	return Intent;
}

FUE5Intent UUE5IntentFactory::BuildAttackIntent(const FString& PlayerId, const FString& EntityId,
	const FString& Weapon, int64 Seq)
{
	FUE5Intent Intent;
	Intent.PlayerId = PlayerId;
	Intent.EntityId = EntityId;
	Intent.Type = TEXT("attack"); // SAMA dengan input.ts:118
	Intent.PayloadJson = FString::Printf(TEXT("{\"weapon\":\"%s\"}"), *Weapon);
	Intent.Seq = Seq;
	return Intent;
}
