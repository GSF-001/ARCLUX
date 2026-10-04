// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5Tokens.h — SATU sumber warna/tipografi/glow/glass (mirror tokens.ts).
// 04-graphics.md §4.6.1: DataTable token = satu-satunya sumber kebenaran
// visual. Di UE jadi DataTable DT_ArcluxColors/DT_ArcluxType (editor PC);
// file ini mesin nilai default-nya — jangan hardcode hex di widget lain.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "UE5Tokens.generated.h"

// Satu baris DataTable: nama token → hex. DT dibuat di editor dari tabel ini.
USTRUCT(BlueprintType)
struct FUE5ColorRow : public FTableRowBase
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString TokenName;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString Hex;
};

// Parameter material kaca (04-graphics §4.6.2 — WAS a glass spec).
USTRUCT(BlueprintType)
struct FUE5GlassStyle
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString BaseColor = TEXT("#04060d"); // voidDeep
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Opacity = 0.55;                // panelBg-level
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString EdgeGlow = TEXT("#52c8ff");    // tech
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double EdgeGlowIntensity = 0.35;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) double Noise = 0.02;                    // anti flat
	UPROPERTY(EditAnywhere, BlueprintReadWrite) bool bScanline = true;
};

UCLASS()
class UE5_API UUE5Tokens : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
public:
	// Mirror tokens.ts — nilai kontrak. Hex SAMA, bukan "mirip".
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FString ColorHex(const FString& TokenName);

	// Mirror typography.sizes (px): micro 9 / data 11 / label 12 / title 15 / display 22.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static int32 FontSizePx(const FString& SizeName);

	// Motion token: 120–300ms (04-graphics §4.6.3). Nama: quick/std/slow.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static double TransitionMs(const FString& Kind);

	// Glass default (satu grammar di seluruh UI — §4.10.4).
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static FUE5GlassStyle GlassDefault();
};
