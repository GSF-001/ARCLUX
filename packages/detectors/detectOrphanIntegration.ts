// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.
//
// The "code yatim butuh diintegrasikan kemana" detector. detectOrphanFiles
// answers WHAT is orphaned; this detector answers WHERE it should be
// wired. It never guesses from nothing — every suggestion is derived from
// real import patterns in the same repository:
//
//   1. Barrel aggregation   — a folder's index.ts that imports sibling
//      files but skips this one is the most likely integration point.
//   2. Sibling-importer aggregation — files in the same folder that ARE
//      imported usually share importers; those shared importers are the
//      candidates. Score = fraction of imported siblings that share the
//      importer.
//   3. Pattern-group weighting — siblings that share a structural name
//      pattern ("Service", "use…", "Controller") are the strongest
//      evidence, because a group of same-kind files is typically wired
//      from the same place.
//
// Confidence is derived from the score, and evidence is always attached
// so a human can verify the reasoning instead of trusting the tool.

import type { Repository } from "../repository/Repository";
import type { ModuleInfo } from "../shared/types";
import {
  detectOrphanFiles,
  sharedNamePattern,
  type OrphanClassification,
} from "./detectOrphanFiles";

export type SuggestionConfidence = "high" | "medium" | "low";

export interface IntegrationSuggestion {
  /** Module that should import the orphan file. */
  filePath: string;
  confidence: SuggestionConfidence;
  /** 0..1 — fraction of imported siblings that share this importer. */
  score: number;
  /** Human-readable reasoning behind the suggestion. */
  reason: string;
  /** Sibling files used as evidence for this suggestion. */
  viaSiblings: string[];
}

export interface OrphanIntegrationFinding {
  filePath: string;
  classification: OrphanClassification;
  suggestedImporters: IntegrationSuggestion[];
  message: string;
}

interface Candidate {
  filePath: string;
  viaSiblings: string[];
  barrel?: boolean;
}

export function detectOrphanIntegration(repository: Repository): OrphanIntegrationFinding[] {
  return detectOrphanFiles(repository).map((orphan) => {
    const module = repository
      .getAllModules()
      .find((m) => m.file.relativePath === orphan.filePath);
    if (!module) {
      return {
        filePath: orphan.filePath,
        classification: orphan.classification,
        suggestedImporters: [],
        message: orphan.message,
      };
    }

    const suggestedImporters = orphan.classification === "dead" ? [] : suggestImporters(module, repository);

    let message: string;
    if (orphan.classification === "dead") {
      message = `"${orphan.filePath}" looks like dead code — deletion beats integration. Evidence: ${orphan.evidence.join("; ")}.`;
    } else if (suggestedImporters.length === 0) {
      message = `"${orphan.filePath}" is never imported and no integration pattern was found in this repository.`;
    } else {
      const top = suggestedImporters[0];
      const rest =
        suggestedImporters.length > 1
          ? ` Alternatives: ${suggestedImporters
              .slice(1, 3)
              .map((s) => `${s.filePath} (${s.confidence})`)
              .join(", ")}.`
          : "";
      message = `"${orphan.filePath}" is never imported — best integration point: ${top.filePath} (${top.confidence} confidence, ${top.reason}).${rest}`;
    }

    return { filePath: orphan.filePath, classification: orphan.classification, suggestedImporters, message };
  });
}

// ─────────────────────────────────────────────────────────────
// Suggestion engine
// ─────────────────────────────────────────────────────────────

function siblingModules(module: ModuleInfo, repository: Repository): ModuleInfo[] {
  const folder = module.file.relativePath.includes("/")
    ? module.file.relativePath.slice(0, module.file.relativePath.lastIndexOf("/"))
    : "";
  return repository.getAllModules().filter((m) => {
    if (m.id === module.id) return false;
    const other = m.file.relativePath;
    if (folder === "") return !other.includes("/");
    return other.startsWith(`${folder}/`) && !other.slice(folder.length + 1).includes("/");
  });
}

function suggestImporters(module: ModuleInfo, repository: Repository): IntegrationSuggestion[] {
  const filePath = module.file.relativePath;
  const siblings = siblingModules(module, repository);
  const barrelIndex = siblings.find((s) => /(^|\/)index\.\w+$/.test(s.file.relativePath));

  // The folder's own barrel index is the wiring target, not a peer — if
  // it's imported somewhere it would otherwise pollute the denominator
  // and add the barrel's importer as a spurious candidate.
  const importedSiblings = siblings.filter(
    (s) => s.importedBy.length > 0 && s.id !== barrelIndex?.id
  );
  if (importedSiblings.length === 0) return [];

  const myPattern = sharedNamePattern(filePath);

  // Candidate aggregation: importer -> siblings importing it. importedBy
  // can contain duplicate ids (buildIndex may record the same edge more
  // than once), so dedupe per sibling — otherwise viaSiblings inflates
  // and scores can exceed 1. A candidate that is the orphan itself is
  // nonsense (a file can't import itself to be "integrated").
  const candidates = new Map<string, Candidate>();
  for (const sibling of importedSiblings) {
    for (const importerId of new Set(sibling.importedBy)) {
      if (importerId === module.id) continue;
      const existing = candidates.get(importerId);
      if (existing) {
        existing.viaSiblings.push(sibling.file.relativePath);
      } else {
        candidates.set(importerId, {
          filePath: importerId,
          viaSiblings: [sibling.file.relativePath],
        });
      }
    }
  }

  // Barrel index in the same folder gets its own high-trust candidate.
  if (barrelIndex && barrelIndex.importedBy.length > 0) {
    const via = importedSiblings.filter((s) => barrelIndex.imports.includes(s.id));
    if (via.length > 0) {
      const existing = candidates.get(barrelIndex.id);
      if (existing) {
        existing.barrel = true;
      } else {
        candidates.set(barrelIndex.id, { filePath: barrelIndex.id, viaSiblings: via.map((s) => s.file.relativePath), barrel: true });
      }
    }
  }

  const suggestions: IntegrationSuggestion[] = [];
  for (const candidate of candidates.values()) {
    const score = candidate.viaSiblings.length / importedSiblings.length;

    // Pattern-group weighting: if every evidence sibling shares the
    // orphan's structural pattern, the group is same-kind and the
    // importer is a much stronger signal — bump confidence one level.
    const viaPatterns = candidate.viaSiblings.filter((s) => sharedNamePattern(s) === myPattern);
    const patternBump = myPattern && viaPatterns.length === candidate.viaSiblings.length;

    let confidence: SuggestionConfidence;
    if (candidate.barrel || score >= 0.5) confidence = "high";
    else if (score >= 0.3) confidence = "medium";
    else confidence = "low";
    if (patternBump && confidence === "low") confidence = "medium";
    if (patternBump && confidence === "medium") confidence = "high";

    const via = candidate.viaSiblings.join(", ");
    const reason = candidate.barrel
      ? `barrel index imports ${candidate.viaSiblings.length} sibling(s)`
      : `${candidate.viaSiblings.length}/${importedSiblings.length} imported sibling(s) are imported from here`;
    suggestions.push({
      filePath: candidate.filePath,
      confidence,
      score: candidate.barrel ? 1 : score,
      reason: patternBump ? `${reason} (all same-kind "${myPattern}" files)` : reason,
      viaSiblings: candidate.viaSiblings,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath)).slice(0, 3);
}