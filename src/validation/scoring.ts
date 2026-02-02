/**
 * Tier2 scoring combining structural matches and modernity.
 * @module validation/scoring
 */

import type { ScoutConfig } from '../config.js'

/**
 * Computes the tier2 score for a validated repository.
 *
 * tier2 = tier1 + wStructural * structuralMatchCount + wModernity * modernityScore
 */
export function computeTier2Score(
  tier1Score: number,
  structuralMatchCount: number,
  modernityScore: number,
  config: ScoutConfig
): number {
  const { scoring } = config

  // Normalize structural match count (cap at 3 unique kinds)
  const structuralNorm = Math.min(structuralMatchCount, 3) / 3

  // Weighted combination
  const tier2 =
    tier1Score +
    scoring.wStructural * structuralNorm +
    scoring.wModernity * modernityScore

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, tier2))
}
