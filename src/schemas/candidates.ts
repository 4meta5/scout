/**
 * Schema definitions for candidate repositories discovered via GitHub search.
 * @module schemas/candidates
 */

import { z } from 'zod'

/**
 * A candidate repository discovered during tier1 search.
 */
export const CandidateRepoTier1Schema = z.object({
  /** Full repo identifier (owner/name) */
  repo: z.string(),
  /** GitHub URL */
  url: z.string().url(),
  /** Star count */
  stars: z.number().int().nonnegative(),
  /** Fork count */
  forks: z.number().int().nonnegative(),
  /** ISO timestamp of last push */
  pushedAt: z.string().datetime(),
  /** SPDX license identifier or null if unknown */
  licenseSpdx: z.string().nullable(),
  /** Repository description */
  description: z.string().nullable(),
  /** GitHub topics */
  topics: z.array(z.string()),
  /** Which search lanes matched this repo */
  laneHits: z.array(z.string()),
  /** Calculated tier1 score */
  tier1Score: z.number().min(0).max(1),
})

export type CandidateRepoTier1 = z.infer<typeof CandidateRepoTier1Schema>

/**
 * Array of tier1 candidates.
 */
export const CandidatesTier1Schema = z.object({
  /** Timestamp when discovery was run */
  timestamp: z.string().datetime(),
  /** Unique run identifier */
  runId: z.string(),
  /** Number of API queries made */
  queriesExecuted: z.number().int().nonnegative(),
  /** Total candidates before filtering */
  totalFound: z.number().int().nonnegative(),
  /** Candidates after filtering and scoring */
  candidates: z.array(CandidateRepoTier1Schema),
})

export type CandidatesTier1 = z.infer<typeof CandidatesTier1Schema>
