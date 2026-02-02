/**
 * Schema definitions for validation results.
 * @module schemas/validation
 */

import { z } from 'zod'
import { ComponentKindSchema } from './targets.js'

/**
 * A matched target from structural validation.
 */
export const MatchedTargetSchema = z.object({
  /** The kind of component matched */
  kind: ComponentKindSchema,
  /** Evidence strings supporting this match */
  evidence: z.array(z.string()),
  /** Root directories to focus on for this kind */
  focusRoots: z.array(z.string()),
})

export type MatchedTarget = z.infer<typeof MatchedTargetSchema>

/**
 * Result of a modernity check.
 */
export const ModernitySignalSchema = z.object({
  /** Name of the check */
  check: z.string(),
  /** Whether the check passed */
  passed: z.boolean(),
  /** Optional detail about the result */
  detail: z.string().optional(),
})

export type ModernitySignal = z.infer<typeof ModernitySignalSchema>

/**
 * Entrypoint candidate for focus generation.
 */
export const EntrypointCandidateSchema = z.object({
  /** The kind of component this entrypoint serves */
  kind: ComponentKindSchema,
  /** Paths to potential entrypoint files */
  paths: z.array(z.string()),
})

export type EntrypointCandidate = z.infer<typeof EntrypointCandidateSchema>

/**
 * Validation result for a single repository.
 */
export const ValidationResultSchema = z.object({
  /** Full repo identifier (owner/name) */
  repo: z.string(),
  /** Local path where repo is cached */
  localPath: z.string(),
  /** Matched component targets */
  matchedTargets: z.array(MatchedTargetSchema),
  /** Modernity check results */
  modernitySignals: z.array(ModernitySignalSchema),
  /** Count of unique matched component kinds */
  structuralMatchCount: z.number().int().nonnegative(),
  /** Modernity score (0-1) */
  modernityScore: z.number().min(0).max(1),
  /** Original tier1 score */
  tier1Score: z.number().min(0).max(1),
  /** Combined tier2 score */
  tier2Score: z.number().min(0).max(1),
  /** Entrypoint candidates for focus generation */
  entrypointCandidates: z.array(EntrypointCandidateSchema),
})

export type ValidationResult = z.infer<typeof ValidationResultSchema>

/**
 * Summary of validation across all repos.
 */
export const ValidationSummarySchema = z.object({
  /** Timestamp when validation was run */
  timestamp: z.string().datetime(),
  /** Unique run identifier */
  runId: z.string(),
  /** Total repos validated */
  totalValidated: z.number().int().nonnegative(),
  /** Repos with at least one structural match */
  reposWithMatches: z.number().int().nonnegative(),
  /** Validation results sorted by tier2 score descending */
  results: z.array(ValidationResultSchema),
})

export type ValidationSummary = z.infer<typeof ValidationSummarySchema>
