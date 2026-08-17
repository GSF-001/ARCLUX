import type { SecurityFinding } from "../SecurityFinding"; export interface RemoteImpactReport { source: string; findings: SecurityFinding[]; }
