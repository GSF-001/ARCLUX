// Copyright 2026 GSF-001. ARCLUX MMO License v1 — see LICENSE-MMO.
// ARCLUXUE.Build.cs — Slice 0 (00-migrasi.md §2). Modules: HTTP, JSON, UMG, Niagara, EnhancedInput.

using UnrealBuildTool;

public class ARCLUXUE : ModuleRules
{
	public ARCLUXUE(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"HTTP",
			"Json",
			"JsonUtilities",
			"UMG",
			"Niagara"
		});
	}
}
