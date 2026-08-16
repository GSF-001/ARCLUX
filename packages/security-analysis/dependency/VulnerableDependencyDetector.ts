import type { SecurityFinding } from "../SecurityFinding"; export interface VulnerableDependencyDetector { detect(dependency: string): SecurityFinding[]; }
export function createVulnerableDependencyDetector(): VulnerableDependencyDetector { return { detect: () => [] }; }
