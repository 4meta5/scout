/**
 * Schema definitions for watch mode types.
 * @module schemas/watch
 */

import { z } from 'zod'
import { ComponentKindSchema } from './targets.js'

/**
 * Tracked repository in the watch database.
 */
export const TrackedRepoSchema = z.object({
  /** Database ID */
  id: z.number().int().positive(),
  /** Full repo identifier (owner/name) */
  repo: z.string(),
  /** Repository URL */
  url: z.string().url(),
  /** Local path where repo is cached */
  localPath: z.string(),
  /** Git SHA at time of tracking (baseline for diffs) */
  baselineSha: z.string(),
  /** Latest fetched SHA (null if not yet fetched) */
  lastSha: z.string().nullable(),
  /** Tier2 score from validation */
  tier2Score: z.number().min(0).max(1),
  /** ISO timestamp when tracking was created */
  createdAt: z.string(),
})

export type TrackedRepo = z.infer<typeof TrackedRepoSchema>

/**
 * Tracked path within a repo for drift detection.
 */
export const TrackedPathSchema = z.object({
  /** Database ID */
  id: z.number().int().positive(),
  /** Foreign key to tracked_repos */
  repoId: z.number().int().positive(),
  /** Component kind this path belongs to */
  kind: ComponentKindSchema,
  /** Relative path within the repo */
  path: z.string(),
})

export type TrackedPath = z.infer<typeof TrackedPathSchema>

/**
 * Review session status.
 */
export const ReviewStatusSchema = z.enum([
  'pending',
  'running',
  'success',
  'failure',
  'skipped',
])

export type ReviewStatus = z.infer<typeof ReviewStatusSchema>

/**
 * Review session in the watch database.
 */
export const ReviewSessionSchema = z.object({
  /** Database ID */
  id: z.number().int().positive(),
  /** Foreign key to tracked_repos */
  repoId: z.number().int().positive(),
  /** Path to the generated session directory */
  sessionPath: z.string(),
  /** Old git SHA (baseline) */
  oldSha: z.string(),
  /** New git SHA (target) */
  newSha: z.string(),
  /** Target component kind for scoped review (optional) */
  targetKind: ComponentKindSchema.nullable(),
  /** Review status */
  status: ReviewStatusSchema,
  /** Number of diff chunks */
  chunkCount: z.number().int().positive(),
  /** ISO timestamp when review started */
  startedAt: z.string().nullable(),
  /** ISO timestamp when review finished */
  finishedAt: z.string().nullable(),
  /** Exit code of the review process */
  exitCode: z.number().int().nullable(),
  /** ISO timestamp when session was created */
  createdAt: z.string(),
})

export type ReviewSession = z.infer<typeof ReviewSessionSchema>

/**
 * Input for creating a tracked repo (omits auto-generated fields).
 */
export const TrackedRepoInputSchema = TrackedRepoSchema.omit({
  id: true,
  lastSha: true,
  createdAt: true,
})

export type TrackedRepoInput = z.infer<typeof TrackedRepoInputSchema>

/**
 * Input for creating a tracked path (omits auto-generated fields).
 */
export const TrackedPathInputSchema = TrackedPathSchema.omit({
  id: true,
})

export type TrackedPathInput = z.infer<typeof TrackedPathInputSchema>

/**
 * Input for creating a review session (omits auto-generated fields).
 */
export const ReviewSessionInputSchema = ReviewSessionSchema.omit({
  id: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  exitCode: true,
  createdAt: true,
})

export type ReviewSessionInput = z.infer<typeof ReviewSessionInputSchema>

/**
 * Review context JSON written to each session directory.
 */
export const ReviewContextSchema = z.object({
  /** Full repo identifier */
  repo: z.string(),
  /** Repository URL */
  url: z.string().url(),
  /** Old git SHA */
  oldSha: z.string(),
  /** New git SHA */
  newSha: z.string(),
  /** Target component kind (if scoped) */
  targetKind: ComponentKindSchema.nullable(),
  /** Tracked paths for drift detection */
  trackedPaths: z.array(z.object({
    kind: ComponentKindSchema,
    path: z.string(),
  })),
  /** Whether drift was detected */
  hasDrift: z.boolean(),
  /** Number of diff chunks */
  chunkCount: z.number().int().positive(),
  /** Estimated token count */
  estimatedTokens: z.number().int().nonnegative(),
  /** Differential-review skill name */
  skillName: z.string(),
  /** Pinned differential-review skill commit */
  skillCommit: z.string(),
  /** ISO timestamp */
  createdAt: z.string().datetime(),
})

export type ReviewContext = z.infer<typeof ReviewContextSchema>

/**
 * Drift information for a path that moved/renamed/deleted.
 */
export const DriftEntrySchema = z.object({
  /** Original path */
  oldPath: z.string(),
  /** New path (null if deleted) */
  newPath: z.string().nullable(),
  /** Drift type */
  type: z.enum(['renamed', 'moved', 'deleted']),
  /** Similarity percentage for renames (0-100) */
  similarity: z.number().int().min(0).max(100).optional(),
})

export type DriftEntry = z.infer<typeof DriftEntrySchema>
