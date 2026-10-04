// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5Tokens.h"

namespace
{
	// Persis tokens.ts:colors — jangan edit tanpa sinkron tokens.ts.
	const TMap<FString, FString> KColors = {
		{ TEXT("void"), TEXT("#02030a") },
		{ TEXT("voidDeep"), TEXT("#04060d") },
		{ TEXT("struct"), TEXT("#1a2436") },
		{ TEXT("structHigh"), TEXT("#2c3a55") },
		{ TEXT("edge"), TEXT("#3a4a6a") },
		{ TEXT("foreground"), TEXT("#c9d6ff") },
		{ TEXT("body"), TEXT("#9fb2d8") },
		{ TEXT("muted"), TEXT("#5a6e92") },
		{ TEXT("empty"), TEXT("#31405c") },
		{ TEXT("tech"), TEXT("#52c8ff") },
		{ TEXT("techDim"), TEXT("#2a6a9a") },
		{ TEXT("tactical"), TEXT("#ffb36b") },
		{ TEXT("tacticalDim"), TEXT("#8a5a2e") },
		{ TEXT("ok"), TEXT("#5fe0a0") },
		{ TEXT("warn"), TEXT("#f5a742") },
		{ TEXT("danger"), TEXT("#ff5a5f") },
		{ TEXT("deplete"), TEXT("#8a5a2e") },
		{ TEXT("factionA"), TEXT("#7d5cff") },
		{ TEXT("factionB"), TEXT("#ff7d5c") },
		{ TEXT("neutral"), TEXT("#8f9bb3") },
		{ TEXT("hull"), TEXT("#2b3a55") },
		{ TEXT("hullHigh"), TEXT("#1f2a42") },
		{ TEXT("stationHub"), TEXT("#335a7a") },
		{ TEXT("stationRing"), TEXT("#2b4a66") },
		{ TEXT("glowEngine"), TEXT("#4cc9ff") },
		{ TEXT("glowShield"), TEXT("#3aa0ff") },
		{ TEXT("glowStation"), TEXT("#67e8f9") }
	};
	const TMap<FString, int32> KFontSizes = {
		{ TEXT("micro"), 9 }, { TEXT("data"), 11 }, { TEXT("label"), 12 },
		{ TEXT("title"), 15 }, { TEXT("display"), 22 }
	};
}

FString UUE5Tokens::ColorHex(const FString& TokenName)
{
	const FString* Found = KColors.Find(TokenName);
	return Found ? *Found : TEXT("#000000");
}

int32 UUE5Tokens::FontSizePx(const FString& SizeName)
{
	const int32* Found = KFontSizes.Find(SizeName);
	return Found ? *Found : 11;
}

double UUE5Tokens::TransitionMs(const FString& Kind)
{
	if (Kind == TEXT("quick")) return 120.0;
	if (Kind == TEXT("slow")) return 300.0;
	return 200.0; // std
}

FUE5GlassStyle UUE5Tokens::GlassDefault()
{
	return FUE5GlassStyle();
}
