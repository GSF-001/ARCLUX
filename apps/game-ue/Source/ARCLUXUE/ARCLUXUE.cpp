// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// ARCLUXUE.cpp — Slice 0 boot. Transport + poll dimulai di Slice 1.

#include "ARCLUXUE.h"

void UARCLUXUEGameInstance::Init()
{
	Super::Init();
	// Slice 1: buat UArcluxTransport di sini, mulai PollSnapshot (100ms).
}

void UARCLUXUEGameInstance::Shutdown()
{
	// Slice 1: stop timer poll di sini.
	Super::Shutdown();
}
