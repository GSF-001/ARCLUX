// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.

#include "UE5NpeWidget.h"

static const TCHAR* KSteps[5][2] = {
	{ TEXT("MOVEMENT"), TEXT("W A S D") },
	{ TEXT("CAMERA"), TEXT("MOUSE") },
	{ TEXT("DOCK"), TEXT("G") },
	{ TEXT("FIRE"), TEXT("F") },
	// Gate/warp baru ada di Slice 6 — sebelum itu langkah ini menunggu intent "teleport" terikat.
	{ TEXT("NAVIGATE"), TEXT("SLICE 6") }
};

void UUE5NpeWidget::Start()
{
	StepIndex = 0;
	bFinished = false;
	OnStepChanged(StepIndex);
}

void UUE5NpeWidget::Skip()
{
	if (bFinished) return;
	bFinished = true;
	OnFinished.Broadcast();
}

void UUE5NpeWidget::ReportEvent(int32 StepId)
{
	if (bFinished) return;
	// Centang hanya step yang sedang aktif (state-driven, bukan tombol manual).
	if (StepId == StepIndex)
	{
		Advance();
	}
}

void UUE5NpeWidget::Advance()
{
	StepIndex++;
	if (StepIndex >= 5)
	{
		bFinished = true;
		OnFinished.Broadcast();
		return;
	}
	OnStepChanged(StepIndex);
}

FString UUE5NpeWidget::StepTitle(int32 StepId)
{
	return (StepId >= 0 && StepId < 5) ? KSteps[StepId][0] : TEXT("");
}

FString UUE5NpeWidget::StepKeyHint(int32 StepId)
{
	return (StepId >= 0 && StepId < 5) ? KSteps[StepId][1] : TEXT("");
}
