/**
 * Track command logic - Add validated repos to watch list.
 * @module watch/track
 */

import { readFile } from 'node:fs/promises'
import {
  insertTrackedRepo,
  insertTrackedPaths,
  getTrackedRepoByName,
  getAllTrackedRepos,
} from './db.js'
import { withWatchLock } from './lock.js'
import {
  ValidationSummarySchema,
  type ValidationSummary,
  type ValidationResult,
} from '../schemas/index.js'
import type { TrackedPathInput, TrackedRepoInput } from '../schemas/watch.js'
import { normalizeGitUrl } from '../clone/hardened.js'
import { getHeadSha } from '../clone/hardened.js'

/**
 * Result of tracking a single repo.
 */
export interface TrackResult {
  repo: string
  status: 'added' | 'exists' | 'skipped'
  reason?: string
  id?: number
}

/**
 * Load and parse a validation summary file.
 */
export async function loadValidationSummary(path: string): Promise<ValidationSummary> {
  const content = await readFile(path, 'utf-8')
  return ValidationSummarySchema.parse(JSON.parse(content))
}

/**
 * Extract tracked paths from a validation result.
 * Uses focus roots from matched targets.
 */
function extractTrackedPaths(result: ValidationResult): Array<{ kind: string; path: string }> {
  const paths: Array<{ kind: string; path: string }> = []

  for (const target of result.matchedTargets) {
    for (const focusRoot of target.focusRoots) {
      paths.push({
        kind: target.kind,
        path: focusRoot,
      })
    }
  }

  // Also add entrypoint paths
  for (const candidate of result.entrypointCandidates) {
    for (const path of candidate.paths) {
      paths.push({
        kind: candidate.kind,
        path,
      })
    }
  }

  // Dedupe by path
  const seen = new Set<string>()
  return paths.filter(p => {
    if (seen.has(p.path)) return false
    seen.add(p.path)
    return true
  })
}

/**
 * Track a single repo from a validation result.
 */
export async function trackRepo(result: ValidationResult): Promise<TrackResult> {
  // Check if already tracked
  const existing = await getTrackedRepoByName(result.repo)
  if (existing !== null) {
    return {
      repo: result.repo,
      status: 'exists',
      reason: 'Already tracked',
      id: existing.id,
    }
  }

  // Verify local path exists and get current SHA
  let baselineSha: string
  try {
    baselineSha = await getHeadSha(result.localPath)
  } catch {
    return {
      repo: result.repo,
      status: 'skipped',
      reason: 'Could not read git SHA from local path',
    }
  }

  // Build repo input
  const repoInput: TrackedRepoInput = {
    repo: result.repo,
    url: normalizeGitUrl(result.repo),
    localPath: result.localPath,
    baselineSha,
    tier2Score: result.tier2Score,
  }

  // Insert repo
  const repoId = await insertTrackedRepo(repoInput)

  // Extract and insert tracked paths
  const paths = extractTrackedPaths(result)
  if (paths.length > 0) {
    const pathInputs: TrackedPathInput[] = paths.map(p => ({
      repoId,
      kind: p.kind as TrackedPathInput['kind'],
      path: p.path,
    }))
    await insertTrackedPaths(pathInputs)
  }

  return {
    repo: result.repo,
    status: 'added',
    id: repoId,
  }
}

/**
 * Track repos from a validation summary file.
 */
export async function trackFromValidationSummary(
  summary: ValidationSummary,
  options: {
    /** Only track repos matching this name filter */
    repoFilter?: string
    /** Track all repos (otherwise only those with matches) */
    trackAll?: boolean
  } = {}
): Promise<TrackResult[]> {
  const results: TrackResult[] = []

  // Filter to repos with structural matches unless trackAll
  let candidates = options.trackAll
    ? summary.results
    : summary.results.filter(r => r.structuralMatchCount > 0)

  // Apply repo filter if provided
  if (options.repoFilter !== undefined) {
    candidates = candidates.filter(r => r.repo === options.repoFilter)
  }

  // Track each repo
  for (const candidate of candidates) {
    const result = await trackRepo(candidate)
    results.push(result)
  }

  return results
}

/**
 * Track a single repo by name from a validation summary.
 */
export async function trackSingleRepo(
  summary: ValidationSummary,
  repoName: string
): Promise<TrackResult> {
  const result = summary.results.find(r => r.repo === repoName)

  if (result === undefined) {
    return {
      repo: repoName,
      status: 'skipped',
      reason: `Not found in validation summary`,
    }
  }

  return trackRepo(result)
}

/**
 * List all currently tracked repos.
 */
export async function listTrackedRepos(): Promise<Array<{
  repo: string
  tier2Score: number
  baselineSha: string
  lastSha: string | null
  hasChanges: boolean
}>> {
  const repos = await getAllTrackedRepos()
  return repos.map(r => ({
    repo: r.repo,
    tier2Score: r.tier2Score,
    baselineSha: r.baselineSha,
    lastSha: r.lastSha,
    hasChanges: r.lastSha !== null && r.lastSha !== r.baselineSha,
  }))
}

/**
 * Run track command with lock.
 */
export async function runTrackWithLock<T>(fn: () => Promise<T>): Promise<T> {
  return withWatchLock(fn)
}
