// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5MaterialKit.cpp — angka SAMA materials.ts; jangan "memperbaiki" noise.

#include "UE5MaterialKit.h"

// mulberry32 mirror scene3d/rng.ts.
double UUE5MaterialKit::Mulberry32Next(uint32& State)
{
	State = State + 0x6d2b79f5u;
	uint32 T = State;
	T = (T ^ (T >> 15)) * (1u | T);
	T = (T + ((T ^ (T >> 7)) * (61u | T))) ^ T;
	uint32 R = T ^ (T >> 14);
	return static_cast<double>(R) / 4294967296.0;
}

UUE5MaterialKit::FNoise2D::FNoise2D(int32 Seed, int32 Cells) : Cells(Cells)
{
	uint32 State = static_cast<uint32>(Seed);
	Grid.Reserve(Cells * Cells);
	for (int32 i = 0; i < Cells * Cells; i++)
	{
		Grid.Add(UUE5MaterialKit::Mulberry32Next(State));
	}
}

double UUE5MaterialKit::FNoise2D::Smootherstep(double T)
{
	return T * T * T * (T * (T * 6.0 - 15.0) + 10.0);
}

double UUE5MaterialKit::FNoise2D::Sample(double U, double V) const
{
	const double X = U * Cells;
	const double Y = V * Cells;
	const int32 Xi = FMath::FloorToInt(X);
	const int32 Yi = FMath::FloorToInt(Y);
	const double Xf = X - Xi;
	const double Yf = Y - Yi;
	auto At = [&](int32 X2, int32 Y2) -> double
	{
		const int32 Wx = ((X2 % Cells) + Cells) % Cells;
		const int32 Wy = ((Y2 % Cells) + Cells) % Cells;
		return Grid[Wy * Cells + Wx];
	};
	const double A = At(Xi, Yi);
	const double B = At(Xi + 1, Yi);
	const double C = At(Xi, Yi + 1);
	const double D = At(Xi + 1, Yi + 1);
	const double U2 = Smootherstep(Xf);
	const double V2 = Smootherstep(Yf);
	return A + (B - A) * U2 + (C - A) * V2 + (A - B - C + D) * U2 * V2;
}

int32 UUE5MaterialKit::TextureSizeForPreset(const FString& Preset)
{
	if (Preset == TEXT("LOW")) return 128;
	if (Preset == TEXT("MEDIUM")) return 256;
	return 512;
}

int32 UUE5MaterialKit::TextureBudgetMB(const FString& Preset)
{
	if (Preset == TEXT("LOW")) return 8;
	if (Preset == TEXT("MEDIUM")) return 24;
	return 48;
}

int32 UUE5MaterialKit::EstimateTextureMB(int32 Size, int32 Count)
{
	return (Size * Size * 4 * Count) / 1048576;
}

static TArray<uint8> HexToRgb(const FString& Hex)
{
	FString H = Hex;
	H.RemoveFromStart(TEXT("#"));
	const uint32 V = FParse::HexNumber(*H);
	return { static_cast<uint8>((V >> 16) & 0xFF), static_cast<uint8>((V >> 8) & 0xFF), static_cast<uint8>(V & 0xFF) };
}

TArray<uint8> UUE5MaterialKit::MakeHullAlbedo(const FString& BaseColorHex, int32 Seed, int32 Size)
{
	const TArray<uint8> Rgb = HexToRgb(BaseColorHex);
	const FNoise2D Noise(Seed, 24);
	const FNoise2D Fine(Seed ^ 0x9e37, 96);
	TArray<uint8> Data;
	Data.SetNumUninitialized(Size * Size * 4);
	const int32 Cell = FMath::Max(8, Size / 8);
	for (int32 Y = 0; Y < Size; Y++)
	{
		for (int32 X = 0; X < Size; X++)
		{
			const double U = static_cast<double>(X) / Size;
			const double V = static_cast<double>(Y) / Size;
			const double N = (Noise.Sample(U, V) - 0.5) * 0.16 + (Fine.Sample(U, V) - 0.5) * 0.05;
			const bool bOnLineX = X % Cell < 2;
			const bool bOnLineY = Y % Cell < 2;
			const bool bNearLineX = X % Cell < 4;
			const bool bNearLineY = Y % Cell < 4;
			double Mul = 1.0 + N;
			if (bOnLineX || bOnLineY) Mul *= 0.65;
			else if (bNearLineX || bNearLineY) Mul *= 1.06;
			const int32 I = (Y * Size + X) * 4;
			Data[I] = FMath::Clamp(FMath::RoundToInt(Rgb[0] * Mul), 0, 255);
			Data[I + 1] = FMath::Clamp(FMath::RoundToInt(Rgb[1] * Mul), 0, 255);
			Data[I + 2] = FMath::Clamp(FMath::RoundToInt(Rgb[2] * Mul), 0, 255);
			Data[I + 3] = 255;
		}
	}
	return Data;
}

TArray<uint8> UUE5MaterialKit::MakeRoughnessMap(int32 Seed, double Lo, double Hi, int32 Size)
{
	const FNoise2D Noise(Seed, 10);
	const FNoise2D Fine(Seed ^ 0x51f7, 48);
	TArray<uint8> Data;
	Data.SetNumUninitialized(Size * Size * 4);
	for (int32 Y = 0; Y < Size; Y++)
	{
		for (int32 X = 0; X < Size; X++)
		{
			const double V = Lo + (Hi - Lo) * (Noise.Sample(static_cast<double>(X) / Size, static_cast<double>(Y) / Size) * 0.7 + Fine.Sample(static_cast<double>(X) / Size, static_cast<double>(Y) / Size) * 0.3);
			const int32 Byte = FMath::Clamp(FMath::RoundToInt(V * 255.0), 0, 255);
			const int32 I = (Y * Size + X) * 4;
			Data[I] = Byte;
			Data[I + 1] = Byte;
			Data[I + 2] = Byte;
			Data[I + 3] = 255;
		}
	}
	return Data;
}

TArray<uint8> UUE5MaterialKit::MakeNormalMapFromNoise(int32 Seed, int32 Size, double Strength)
{
	const FNoise2D Height(Seed, 32);
	auto H = [&](int32 X, int32 Y) -> double
	{
		const double Wx = static_cast<double>(((X % Size) + Size) % Size) / Size;
		const double Wy = static_cast<double>(((Y % Size) + Size) % Size) / Size;
		return Height.Sample(Wx, Wy);
	};
	TArray<uint8> Data;
	Data.SetNumUninitialized(Size * Size * 4);
	for (int32 Y = 0; Y < Size; Y++)
	{
		for (int32 X = 0; X < Size; X++)
		{
			const double Dx = (H(X + 1, Y) - H(X - 1, Y)) * Strength;
			const double Dy = (H(X, Y + 1) - H(X, Y - 1)) * Strength;
			const double Inv = 1.0 / FMath::Sqrt(Dx * Dx + Dy * Dy + 1.0);
			const int32 I = (Y * Size + X) * 4;
			Data[I] = FMath::RoundToInt((-Dx * Inv * 0.5 + 0.5) * 255.0);
			Data[I + 1] = FMath::RoundToInt((-Dy * Inv * 0.5 + 0.5) * 255.0);
			Data[I + 2] = FMath::RoundToInt(Inv * 255.0);
			Data[I + 3] = 255;
		}
	}
	return Data;
}
