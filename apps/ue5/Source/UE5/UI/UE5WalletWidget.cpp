// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5WalletWidget.h"

FString UUE5WalletWidget::FormatOc(int64 Value)
{
	FString Digits = FString::FromInt(Value);
	FString Out;
	int32 Count = 0;
	for (int32 i = Digits.Len() - 1; i >= 0; i--)
	{
		Out = Digits.Mid(i, 1) + Out;
		if (++Count % 3 == 0 && i > 0 && Digits[0] != TEXT('-'))
		{
			Out = TEXT(",") + Out;
		}
	}
	return FString::Printf(TEXT("OC: %s"), *Out);
}

void UUE5WalletWidget::PushOc(int64 NewOc)
{
	if (NewOc == Oc) return;
	Oc = NewOc;
	Display = FormatOc(Oc);
	OnOcChanged(Oc);
}
