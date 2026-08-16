import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeSecuritySource, type SecurityAnalysis } from "./SecurityAnalysis";
import type { SecurityFile } from "./contracts";
import type { Repository } from "../repository/Repository";
import { assessCapabilitySource } from "./capability/AssessmentOrchestrator";

export function analyzeRepositorySecurity(repository: Repository, rootPath = repository.meta.rootPath): SecurityAnalysis {
  const files: SecurityFile[] = repository.getAllModules().flatMap((module) => {
    try {
      return [{
    file: module.file.relativePath,
    source: readFileSync(path.join(rootPath, module.file.relativePath), "utf8"),
      }];
    } catch {
      return [];
    }
  });
  const analysis = analyzeSecuritySource({ target: repository.meta.name, files });
  analysis.capabilityAssessment = assessCapabilitySource(`mock://${repository.meta.name}`, files);
  return analysis;
}
