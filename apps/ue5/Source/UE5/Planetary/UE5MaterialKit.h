// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5MaterialKit.h — Slice 3 M1: port bit-identik materials.ts (10.V §M1.1).
// RUMUS IDENTIK: mulberry32 + value-noise 2D tileable + Sobel normal.
// Ubah angka = dua client beda tekstur = bug MMO (00-migrasi.md §5).
// Output RGBA byte array — editor/PC membungkus ke UTexture2D (slice PC).

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "UE5MaterialKit.generated.h"

UCLASS()
class UE5_API UUE5MaterialKit : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	// Mirror materials.ts:19 textureSizeForPreset. 512 HIGH / 256 MEDIUM / 128 LOW.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static int32 TextureSizeForPreset(const FString& Preset);

	// Mirror materials.ts:25 textureBudgetMB.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static int32 TextureBudgetMB(const FString& Preset);

	// Mirror materials.ts:33 estimateTextureMB.
	UFUNCTION(BlueprintCallable, BlueprintPure)
	static int32 EstimateTextureMB(int32 Size, int32 Count);

	// Mirror materials.ts:80 makeHullAlbedo. RGBA premul-ready, size²*4 bytes.
	// baseColor: hex "#RRGGBB" (mirror token warna §6).
	static TArray<uint8> MakeHullAlbedo(const FString& BaseColorHex, int32 Seed, int32 Size = 256);

	// Mirror materials.ts:116 makeRoughnessMap — nilai di kanal G seragam R=G=B.
	static TArray<uint8> MakeRoughnessMap(int32 Seed, double Lo, double Hi, int32 Size = 256);

	// Mirror materials.ts:145 makeNormalMapFromNoise (Sobel).
	static TArray<uint8> MakeNormalMapFromNoise(int32 Seed, int32 Size = 256, double Strength = 1.5);

private:
	// mulberry32 mirror rng.ts — wajib identik (determinisme lintas client).
	static double Mulberry32Next(uint32& State);

	// Value-noise 2D tileable mirror makeNoise2D (grid cells² + smootherstep).
	class FNoise2D
	{
	public:
		FNoise2D(int32 Seed, int32 Cells);
		double Sample(double U, double V) const;
	private:
		int32 Cells = 0;
		TArray<double> Grid;
		static double Smootherstep(double T);
	};
};
