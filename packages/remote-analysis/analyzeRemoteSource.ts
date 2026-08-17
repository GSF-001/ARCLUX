import { RemoteRepository } from "../remote/RemoteRepository";
import type { RemoteSource } from "../remote/RemoteSource";
import { createRemoteAnalysisResult, type RemoteAnalysisResult } from "./RemoteAnalysisResult";

/** Runs the complete ARCLUX pipeline and preserves both core and security output. */
export async function analyzeRemoteSource(source: RemoteSource): Promise<RemoteAnalysisResult> {
  const startedAt = new Date().toISOString();
  try {
    const analysis = await new RemoteRepository(source).analyze();
    return createRemoteAnalysisResult(source, {
      ok: true,
      startedAt,
      completedAt: new Date().toISOString(),
      analysis,
      security: analysis.securityAnalysis,
    });
  } catch (error) {
    return createRemoteAnalysisResult(source, {
      ok: false,
      startedAt,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
