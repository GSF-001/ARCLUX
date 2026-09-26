// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// UE5.cpp — Slice 0 boot. Transport + poll dimulai di Slice 1.

#include "UE5.h"

void UUE5GameInstance::Init()
{
	Super::Init();
	// Slice 1: buat UUE5Transport di sini, mulai PollSnapshot (100ms).
}

void UUE5GameInstance::Shutdown()
{
	// Slice 1: stop timer poll di sini.
	Super::Shutdown();
}
