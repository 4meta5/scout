/**
 * Schema definitions for focus bundles.
 * @module schemas/focus
 */

import { z } from 'zod'
import { ComponentKindSchema } from './targets.js'

/**
 * An entrypoint in a focus bundle.
 */
export const FocusEntrypointSchema = z.object({
  /** The kind of component */
  kind: ComponentKindSchema,
  /** Path to the entrypoint file */
  path: z.string(),
  /** Reason this was selected as an entrypoint */
  reason: z.string(),
})

export type FocusEntrypoint = z.infer<typeof FocusEntrypointSchema>

/**
 * A file included in the focus bundle.
 */
export const FocusFileSchema = z.object({
  /** Relative path within the repo */
  path: z.string(),
  /** File size in bytes */
  sizeBytes: z.number().int().nonnegative(),
})

export type FocusFile = z.infer<typeof FocusFileSchema>

/**
 * Focus bundle for a repository.
 */
export const FocusBundleSchema = z.object({
  /** Full repo identifier (owner/name) */
  repo: z.string(),
  /** Selected entrypoints */
  entrypoints: z.array(FocusEntrypointSchema),
  /** Root directories included in scope */
  scopeRoots: z.array(z.string()),
  /** Files included in the bundle */
  files: z.array(FocusFileSchema),
})

export type FocusBundle = z.infer<typeof FocusBundleSchema>

/**
 * Run hints for a repository (scripts to run).
 */
export const RunHintsSchema = z.object({
  /** Available scripts with name and command */
  scripts: z.array(
    z.object({
      name: z.string(),
      command: z.string(),
    })
  ),
  /** Detected build tool (npm, pnpm, yarn, etc.) */
  buildTool: z.string().optional(),
})

export type RunHints = z.infer<typeof RunHintsSchema>

/**
 * Provenance information for a focus bundle.
 */
export const ProvenanceSchema = z.object({
  /** Full repo identifier (owner/name) */
  repo: z.string(),
  /** Repository URL */
  url: z.string().url(),
  /** Git commit SHA */
  sha: z.string(),
  /** License identifier */
  license: z.string().nullable(),
  /** Tier1 score from discovery */
  tier1Score: z.number().min(0).max(1),
  /** Tier2 score from validation */
  tier2Score: z.number().min(0).max(1),
  /** Scout tool version */
  toolVersion: z.string(),
  /** Unique run identifier */
  runId: z.string(),
  /** ISO timestamp */
  timestamp: z.string().datetime(),
})

export type Provenance = z.infer<typeof ProvenanceSchema>

/**
 * Focus index listing all generated bundles.
 */
export const FocusIndexSchema = z.object({
  /** Timestamp when focus was generated */
  timestamp: z.string().datetime(),
  /** Unique run identifier */
  runId: z.string(),
  /** List of repos with generated focus bundles */
  repos: z.array(
    z.object({
      repo: z.string(),
      tier2Score: z.number(),
      bundlePath: z.string(),
    })
  ),
})

export type FocusIndex = z.infer<typeof FocusIndexSchema>
