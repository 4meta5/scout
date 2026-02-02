/**
 * Schema definitions for comparison reports.
 * @module schemas/report
 */

import { z } from 'zod'

/**
 * Source project information in the report.
 */
export const SourceProjectSchema = z.object({
  /** Project root path */
  root: z.string(),
  /** Git commit SHA if available */
  commit: z.string().optional(),
  /** Component kinds detected in the project */
  targetKinds: z.array(z.string()),
})

export type SourceProject = z.infer<typeof SourceProjectSchema>

/**
 * Candidate summary in the report.
 */
export const ReportCandidateSchema = z.object({
  /** Full repo identifier (owner/name) */
  repo: z.string(),
  /** Tier1 discovery score */
  tier1Score: z.number().min(0).max(1),
  /** Tier2 validation score */
  tier2Score: z.number().min(0).max(1),
  /** Component kinds matched */
  matchedKinds: z.array(z.string()),
  /** Modernity score */
  modernityScore: z.number().min(0).max(1),
  /** License identifier */
  license: z.string().nullable(),
  /** Top entrypoint paths */
  topEntrypoints: z.array(z.string()),
})

export type ReportCandidate = z.infer<typeof ReportCandidateSchema>

/**
 * Report summary statistics.
 */
export const ReportSummarySchema = z.object({
  /** Total candidates discovered */
  totalDiscovered: z.number().int().nonnegative(),
  /** Number of repos cloned */
  cloned: z.number().int().nonnegative(),
  /** Number of repos validated with matches */
  validated: z.number().int().nonnegative(),
  /** Top recommendation (repo identifier) */
  topRecommendation: z.string().optional(),
})

export type ReportSummary = z.infer<typeof ReportSummarySchema>

/**
 * Full comparison report structure.
 */
export const CompareReportSchema = z.object({
  /** Unique run identifier */
  runId: z.string(),
  /** ISO timestamp */
  timestamp: z.string().datetime(),
  /** Source project information */
  sourceProject: SourceProjectSchema,
  /** Ranked candidates */
  candidates: z.array(ReportCandidateSchema),
  /** Summary statistics */
  summary: ReportSummarySchema,
})

export type CompareReport = z.infer<typeof CompareReportSchema>
