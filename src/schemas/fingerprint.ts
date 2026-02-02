/**
 * Schema definitions for project fingerprints.
 * @module schemas/fingerprint
 */

import { z } from 'zod'

/**
 * Project fingerprint capturing the essential characteristics of a scanned project.
 */
export const FingerprintSchema = z.object({
  /** Absolute path to the project root */
  root: z.string(),
  /** Git HEAD commit SHA if available */
  commit: z.string().optional(),
  /** ISO timestamp when fingerprint was created */
  timestamp: z.string().datetime(),
  /** Map of detected languages to file counts */
  languageCounts: z.record(z.string(), z.number()),
  /** Key markers found (e.g., 'SKILL.md', 'hooks/', 'mcp.json') */
  keyMarkers: z.array(z.string()),
})

export type Fingerprint = z.infer<typeof FingerprintSchema>
