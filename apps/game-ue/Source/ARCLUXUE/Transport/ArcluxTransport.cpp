// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// ArcluxTransport.cpp — Slice 1. HTTP/JSON via modul HTTP + JsonUtilities.
// Interpolasi di UVesselMovementVis (alpha seperti vessels.ts — presentation
// only; simulation.ts p+=v*dt tetap kebenaran). Gate slice 1: snapshot masuk
// + vessel kelihatan + WASD gerak. Gagal = STOP TOTAL (00-migrasi.md §8).

#include "ArcluxTransport.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "JsonObjectConverter.h"
#include "Engine/World.h"
#include "TimerManager.h"

void UArcluxTransport::StartPolling()
{
	if (UWorld* W = GetWorld())
	{
		W->GetTimerManager().ClearTimer(PollTimer);
		W->GetTimerManager().SetTimer(PollTimer, this, &UArcluxTransport::PollOnce, SnapshotIntervalSec, true);
	}
	PollOnce();
}

void UArcluxTransport::StopPolling()
{
	if (UWorld* W = GetWorld())
	{
		W->GetTimerManager().ClearTimer(PollTimer);
	}
}

void UArcluxTransport::PollOnce()
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
	Req->SetURL(ServerBaseUrl + TEXT("/snapshot"));
	Req->SetVerb(TEXT("GET"));
	Req->SetHeader(TEXT("Accept"), TEXT("application/json"));
	Req->OnProcessRequestComplete().BindLambda([this](FHttpRequestPtr, FHttpResponsePtr Res, bool bOk)
	{
		if (!bOk || !Res.IsValid() || Res->GetResponseCode() != 200) return;
		FArcluxSnapshot Snap;
		// Field 1:1 dengan RegionSnapshot (types.ts:105). Parse minimal: tick dulu.
		// Full parse per-field di Slice 2 (StationActor + PlanetaryReader).
		if (FJsonObjectConverter::JsonObjectStringToUStruct<FArcluxSnapshot>(Res->GetContentAsString(), &Snap, 0, 0)
			&& Snap.Tick > LastTickSeen)
		{
			LastTickSeen = Snap.Tick;
			OnSnapshot.Broadcast(Snap);
		}
	});
	Req->ProcessRequest();
}

void UArcluxTransport::SendIntent(const FArcluxIntent& Intent)
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
	Req->SetURL(ServerBaseUrl + TEXT("/intent"));
	Req->SetVerb(TEXT("POST"));
	Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Req->SetTimeout(IntentTimeoutSec);

	// JSON key SAMA persis dengan PlayerIntent TS (types.ts:125).
	const FString Body = FString::Printf(
		TEXT("{\"playerId\":\"%s\",\"entityId\":\"%s\",\"type\":\"%s\",\"payload\":%s,\"seq\":%lld}"),
		*Intent.PlayerId, *Intent.EntityId, *Intent.Type,
		Intent.PayloadJson.IsEmpty() ? TEXT("{}") : *Intent.PayloadJson,
		Intent.Seq);
	Req->SetContentAsString(Body);

	// Retry 1x (00-migrasi.md §4). Penolakan = read-only tampil, bukan validasi ulang.
	Req->OnProcessRequestComplete().BindLambda([this, Intent, Body](FHttpRequestPtr Rq, FHttpResponsePtr Res, bool bOk)
	{
		const bool bAccepted = bOk && Res.IsValid() && Res->GetResponseCode() == 200;
		if (bAccepted) return;
		if (!Rq->GetURL().Contains(TEXT("retry=1")))
		{
			TSharedRef<IHttpRequest, ESPMode::ThreadSafe> R2 = FHttpModule::Get().CreateRequest();
			R2->SetURL(ServerBaseUrl + TEXT("/intent?retry=1"));
			R2->SetVerb(TEXT("POST"));
			R2->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
			R2->SetTimeout(IntentTimeoutSec);
			R2->SetContentAsString(Body);
			R2->OnProcessRequestComplete().BindLambda([this, Intent](FHttpRequestPtr, FHttpResponsePtr R2Res, bool bOk2)
			{
				if (!(bOk2 && R2Res.IsValid() && R2Res->GetResponseCode() == 200))
				{
					OnIntentRejected.Broadcast(Intent.Type, R2Res.IsValid() ? R2Res->GetContentAsString() : TEXT("timeout"));
				}
			});
			R2->ProcessRequest();
			return;
		}
		OnIntentRejected.Broadcast(Intent.Type, Res.IsValid() ? Res->GetContentAsString() : TEXT("timeout"));
	});
	Req->ProcessRequest();
}
