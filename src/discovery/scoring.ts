/**
 * Tier1 scoring for candidate repositories.
 * @module discovery/scoring
 */

import type { ScoutConfig } from '../config.js'

interface ScoringInput {
  pushedAt: string
  stars: number
  forks: number
  laneHitsCount: number
}

/**
 * Clamps a value between 0 and 1.
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Computes the tier1 score for a candidate repository.
 *
 * The score is a weighted combination of:
 * - Recency: How recently the repo was pushed to
 * - Activity: Stars + forks (log-scaled)
 * - Lane hits: How many search lanes matched this repo
 */
export function computeTier1Score(
  input: ScoringInput,
  config: ScoutConfig
): number {
  const { scoring, discovery } = config

  // Recency normalization
  const daysSincePush = Math.max(
    0,
    (Date.now() - new Date(input.pushedAt).getTime()) / (24 * 60 * 60 * 1000)
  )
  const recencyNorm = clamp01(1 - daysSincePush / discovery.recencyWindowDays)

  // Activity normalization (log-scaled)
  const activityLogDivisor = 10 // log(10000) ≈ 9.2, so this gives ~1.0 for very active repos
  const activityNorm = clamp01(Math.log10(input.stars + input.forks + 1) / activityLogDivisor)

  // Lane hits normalization (cap at 3)
  const laneHitCap = 3
  const laneNorm = Math.min(input.laneHitsCount, laneHitCap) / laneHitCap

  // Weighted combination
  const tier1 =
    scoring.wRecency * recencyNorm +
    scoring.wActivity * activityNorm +
    scoring.wLanes * laneNorm

  return clamp01(tier1)
}

/**
 * Checks if a license is in the allow list.
 */
export function isLicenseAllowed(
  licenseSpdx: string | null,
  allowLicenses: string[]
): boolean {
  // Unknown licenses are allowed but deprioritized
  if (!licenseSpdx) return true

  // Normalize license name for comparison
  const normalized = licenseSpdx.toLowerCase().replace(/-/g, '')
  return allowLicenses.some((allowed) =>
    allowed.toLowerCase().replace(/-/g, '') === normalized
  )
}

/**
 * Checks if a repo should be excluded based on keywords.
 */
export function shouldExclude(
  name: string,
  description: string | null,
  excludeKeywords: string[]
): boolean {
  const text = `${name} ${description ?? ''}`.toLowerCase()
  return excludeKeywords.some((kw) => text.includes(kw.toLowerCase()))
}

/**
 * Checks if a repo is too old based on recency window.
 */
export function isTooOld(pushedAt: string, recencyWindowDays: number): boolean {
  const daysSincePush = (Date.now() - new Date(pushedAt).getTime()) / (24 * 60 * 60 * 1000)
  return daysSincePush > recencyWindowDays
}
