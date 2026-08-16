import { analyzeRepositorySecurity } from "../integration";
import type { Repository } from "../../repository/Repository";
import type { SecurityAnalysis } from "../SecurityAnalysis";
export function analyzeRemoteRepositorySecurity(repository: Repository): SecurityAnalysis {
  return analyzeRepositorySecurity(repository);
}
