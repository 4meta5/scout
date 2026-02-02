/**
 * Report generation from validation and focus data.
 * @module report/generator
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CompareReport,
  ReportCandidate,
  ReportSummary,
  SourceProject,
  ValidationSummary,
  FocusIndex,
  Fingerprint,
} from '../schemas/index.js'
import { FingerprintSchema, FocusIndexSchema } from '../schemas/index.js'

/**
 * Loads fingerprint data for source project info.
 */
export async function loadFingerprint(outputDir: string): Promise<Fingerprint | null> {
  try {
    const content = await readFile(join(outputDir, 'fingerprint.json'), 'utf-8')
    return FingerprintSchema.parse(JSON.parse(content))
  } catch {
    return null
  }
}

/**
 * Loads focus index if available.
 */
export async function loadFocusIndex(path: string): Promise<FocusIndex | null> {
  try {
    const content = await readFile(path, 'utf-8')
    return FocusIndexSchema.parse(JSON.parse(content))
  } catch {
    return null
  }
}

/**
 * Generates a comparison report from validation results.
 */
export function generateReport(
  validationSummary: ValidationSummary,
  fingerprint: Fingerprint | null,
  focusIndex: FocusIndex | null,
  totalDiscovered: number,
  runId: string
): CompareReport {
  // Build source project info
  const sourceProject: SourceProject = {
    root: fingerprint?.root ?? process.cwd(),
    commit: fingerprint?.commit,
    targetKinds: [], // Would need targets.json for this
  }

  // Build candidates from validation results
  const candidates: ReportCandidate[] = validationSummary.results.map((result) => {
    // Get top entrypoints
    const topEntrypoints: string[] = []
    for (const candidate of result.entrypointCandidates) {
      for (const path of candidate.paths.slice(0, 2)) {
        if (!topEntrypoints.includes(path)) {
          topEntrypoints.push(path)
        }
        if (topEntrypoints.length >= 5) break
      }
      if (topEntrypoints.length >= 5) break
    }

    return {
      repo: result.repo,
      tier1Score: result.tier1Score,
      tier2Score: result.tier2Score,
      matchedKinds: result.matchedTargets.map((t) => t.kind),
      modernityScore: result.modernityScore,
      license: null, // Would need to preserve from discovery
      topEntrypoints,
    }
  })

  // Build summary
  const summary: ReportSummary = {
    totalDiscovered,
    cloned: validationSummary.totalValidated,
    validated: validationSummary.reposWithMatches,
    topRecommendation: candidates[0]?.repo,
  }

  return {
    runId,
    timestamp: new Date().toISOString(),
    sourceProject,
    candidates,
    summary,
  }
}
