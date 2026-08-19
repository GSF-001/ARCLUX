import { RemoteRepository } from "../remote/RemoteRepository";
import type { RemoteSource } from "../remote/RemoteSource";
import { createRemoteSource } from "../remote/RemoteSource";
import { RemoteAccessPolicy } from "../boundaries/RemoteAccessPolicy";
import { createRepositoryAcquirer } from "../acquisition/RepositoryAcquirer";
import { adaptSource } from "../adapters";
import { createSnapshotFromFiles } from "../acquisition/SourceSnapshot";
import { createRemoteImpactReport } from "./RemoteImpactReport";
import { createSourceHealthReport } from "./SourceHealthReport";
import { createRemoteAnalysisResult, type RemoteAnalysisResult } from "./RemoteAnalysisResult";
import type { RemoteAnalysisRequest } from "./RemoteAnalysisRequest";
import { createRemoteAnalysisSession, updateRemoteAnalysisSession } from "./RemoteAnalysisSession";

/** Runs the complete ARCLUX pipeline and preserves both core and security output. */
export async function analyzeRemoteSource(source: RemoteSource): Promise<RemoteAnalysisResult> {
  const startedAt = new Date().toISOString();
  try {
    // SSRF guard before anything else: a remote URL must pass the access
    // policy (protocol/host allowlists + private-network/metadata block)
    // or the analysis is refused outright.
    if (source.url) {
      RemoteAccessPolicy.default().assert(source.url);
    }
    const acquisition = source.localPath
      ? await createRepositoryAcquirer(source.localPath).acquire()
      : undefined;
    if (acquisition && !acquisition.ok) {
      throw new Error(acquisition.errors.join("; "));
    }
    const snapshot = acquisition?.snapshot;
    const analysis = await new RemoteRepository(source).analyze();
    const analyzedSnapshot = snapshot ?? createSnapshotFromFiles(
      source.url ?? source.localPath ?? source.id,
      analysis.repository.getAllModules().map((module) => module.file.relativePath),
      analysis.meta.defaultBranch,
    );
    return createRemoteAnalysisResult(source, {
      ok: true,
      startedAt,
      completedAt: new Date().toISOString(),
      analysis,
      security: analysis.securityAnalysis,
      snapshot: analyzedSnapshot,
      health: createSourceHealthReport(analyzedSnapshot.source, {
        ok: true,
        files: analysis.scanSummary.filesScanned,
        parsedFiles: analysis.scanSummary.filesParsed,
        skippedFiles: analysis.scanSummary.filesSkippedNoParser,
      }),
      impact: createRemoteImpactReport(analyzedSnapshot.source, analysis.securityAnalysis?.findings ?? []),
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

export async function analyzeRemoteRequest(request: RemoteAnalysisRequest): Promise<RemoteAnalysisResult> {
  if (!request.source) {
    return createRemoteAnalysisResult(undefined, { ok: false, error: "A remote analysis source is required." });
  }

  const source = typeof request.source === "string" ? adaptSource(request.source, { id: request.id ?? undefined }) : request.source;
  let session = createRemoteAnalysisSession(source);
  session = updateRemoteAnalysisSession(session, { status: "running" });
  const result = await analyzeRemoteSource(source);
  session = updateRemoteAnalysisSession(session, { status: result.ok ? "completed" : "failed", result });
  return {
    ...result,
    metadata: { ...result.metadata, requestId: request.id, sessionId: session.id, sessionStatus: session.status },
  };
}
