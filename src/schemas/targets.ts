/**
 * Schema definitions for component targets detected during project scanning.
 * @module schemas/targets
 */

import { z } from 'zod'

/**
 * Kinds of components that Scout can identify.
 */
export const ComponentKindSchema = z.enum([
  'mcp-server',
  'cli',
  'skill',
  'hook',
  'plugin',
  'library',
])

export type ComponentKind = z.infer<typeof ComponentKindSchema>

/**
 * Search hints derived from target analysis.
 */
export const SearchHintsSchema = z.object({
  /** Keywords to search for in repo names/descriptions */
  keywords: z.array(z.string()),
  /** GitHub topics to filter by */
  topics: z.array(z.string()),
  /** Preferred language for search (e.g., 'TypeScript', 'Python') */
  languageBias: z.string().optional(),
})

export type SearchHints = z.infer<typeof SearchHintsSchema>

/**
 * A component target detected in the project being scanned.
 */
export const ComponentTargetSchema = z.object({
  /** The kind of component */
  kind: ComponentKindSchema,
  /** Confidence score (0-1) based on evidence strength */
  confidence: z.number().min(0).max(1),
  /** Evidence strings that led to this detection */
  signals: z.array(z.string()),
  /** Hints for searching similar components */
  searchHints: SearchHintsSchema,
})

export type ComponentTarget = z.infer<typeof ComponentTargetSchema>

/**
 * Array of component targets.
 */
export const ComponentTargetsSchema = z.array(ComponentTargetSchema)

export type ComponentTargets = z.infer<typeof ComponentTargetsSchema>
