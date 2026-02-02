/**
 * Schema definitions for clone manifests.
 * @module schemas/clone
 */

import { z } from 'zod'

/**
 * Entry in the clone manifest for a single repo.
 */
export const CloneEntrySchema = z.object({
  /** Full repo identifier (owner/name) */
  repo: z.string(),
  /** GitHub URL */
  url: z.string().url(),
  /** Local filesystem path where repo is cloned */
  localPath: z.string(),
  /** Git commit SHA at clone time */
  sha: z.string(),
  /** Tier1 score from discovery */
  tier1Score: z.number().min(0).max(1),
})

export type CloneEntry = z.infer<typeof CloneEntrySchema>

/**
 * Clone manifest tracking all cloned repositories.
 */
export const CloneManifestSchema = z.object({
  /** Timestamp when cloning was performed */
  timestamp: z.string().datetime(),
  /** Unique run identifier */
  runId: z.string(),
  /** Number of repos requested to clone */
  requested: z.number().int().nonnegative(),
  /** Number successfully cloned (or already cached) */
  cloned: z.number().int().nonnegative(),
  /** Clone entries */
  entries: z.array(CloneEntrySchema),
})

export type CloneManifest = z.infer<typeof CloneManifestSchema>
