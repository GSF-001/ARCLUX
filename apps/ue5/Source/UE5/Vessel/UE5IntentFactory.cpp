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
	const FString& Weapon, const FString& TargetId, int64 Seq)
{
	FUE5Intent Intent;
	Intent.PlayerId = PlayerId;
	Intent.EntityId = EntityId;
	Intent.Type = TEXT("attack"); // SAMA dengan input.ts:118
	Intent.PayloadJson = FString::Printf(TEXT("{\"weapon\":\"%s\",\"targetId\":\"%s\"}"), *Weapon, *TargetId);
	Intent.Seq = Seq;
	return Intent;
}

static FUE5Intent MakeColonyIntent(const FString& P, const FString& E,
	const FString& Type, const FString& PayloadJson, int64 Seq)
{
	FUE5Intent Intent;
	Intent.PlayerId = P;
	Intent.EntityId = E;
	Intent.Type = Type; // key SAMA dengan TS
	Intent.PayloadJson = PayloadJson;
	Intent.Seq = Seq;
	return Intent;
}

FUE5Intent UUE5IntentFactory::BuildColonyClaimIntent(const FString& P, const FString& E, const FString& PlanetId, const FString& ClaimId, int64 S)
{ return MakeColonyIntent(P, E, TEXT("colony_claim"), FString::Printf(TEXT("{\"planetId\":\"%s\",\"claimId\":\"%s\"}"), *PlanetId, *ClaimId), S); }

FUE5Intent UUE5IntentFactory::BuildColonySubmitIntent(const FString& P, const FString& E, const FString& ColonyId, const FString& Path, int64 S)
{ return MakeColonyIntent(P, E, TEXT("colony_submit"), FString::Printf(TEXT("{\"colonyId\":\"%s\",\"path\":\"%s\"}"), *ColonyId, *Path), S); }

FUE5Intent UUE5IntentFactory::BuildColonyRollbackIntent(const FString& P, const FString& E, const FString& ColonyId, int64 S)
{ return MakeColonyIntent(P, E, TEXT("colony_rollback"), FString::Printf(TEXT("{\"colonyId\":\"%s\"}"), *ColonyId), S); }

FUE5Intent UUE5IntentFactory::BuildStudioPublishIntent(const FString& P, const FString& E, const FString& ColonyId, const FString& Title, int64 S)
{ return MakeColonyIntent(P, E, TEXT("studio_publish"), FString::Printf(TEXT("{\"colonyId\":\"%s\",\"title\":\"%s\"}"), *ColonyId, *Title), S); }

FUE5Intent UUE5IntentFactory::BuildStudioForkIntent(const FString& P, const FString& E, const FString& SourceColonyId, int64 S)
{ return MakeColonyIntent(P, E, TEXT("studio_fork"), FString::Printf(TEXT("{\"sourceColonyId\":\"%s\"}"), *SourceColonyId), S); }
