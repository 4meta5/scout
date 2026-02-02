/**
 * Configuration loading and management for Scout CLI.
 *
 * Config sources are loaded in priority order:
 * 1. Environment variables (GITHUB_TOKEN, SCOUT_*)
 * 2. Project config: .scoutrc.json in current/specified directory
 * 3. Global config: ~/.config/scout/config.json
 *
 * @module config
 */

import { z } from 'zod'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { execa } from 'execa'

/**
 * Zod schema for the github configuration section.
 */
export const GithubConfigSchema = z.object({
  token: z.string().optional(),
})

/**
 * Zod schema for the discovery configuration section.
 */
export const DiscoveryConfigSchema = z.object({
  recencyWindowDays: z.number().int().positive().default(90),
  maxCandidatesTier1: z.number().int().positive().default(50),
  cloneBudget: z.number().int().positive().default(5),
  excludeKeywords: z.array(z.string()).default([]),
  allowLicenses: z
    .array(z.string())
    .default(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'LGPL-3.0', 'Unlicense']),
})

/**
 * Zod schema for the scoring configuration section.
 */
export const ScoringConfigSchema = z.object({
  wRecency: z.number().min(0).max(1).default(0.55),
  wActivity: z.number().min(0).max(1).default(0.25),
  wLanes: z.number().min(0).max(1).default(0.20),
  wStructural: z.number().min(0).max(1).default(0.35),
  wModernity: z.number().min(0).max(1).default(0.20),
})

/**
 * Zod schema for the focus configuration section.
 */
export const FocusConfigSchema = z.object({
  entrypointsPerTarget: z.number().int().positive().default(5),
  maxDirsPerTarget: z.number().int().positive().default(8),
  maxFilesPerDir: z.number().int().positive().default(25),
})

/**
 * Zod schema for the caching configuration section.
 */
export const CachingConfigSchema = z.object({
  ttlHours: z.number().int().positive().default(24),
  maxPagesPerLane: z.number().int().positive().default(2),
})

/**
 * Zod schema for the rate limiting configuration section.
 */
export const RateLimitConfigSchema = z.object({
  searchRequestsPerMinute: z.number().int().positive().default(20),
  backoffBaseMs: z.number().int().positive().default(750),
  backoffMaxMs: z.number().int().positive().default(15000),
})

/**
 * Zod schema for the watch mode configuration section.
 */
export const WatchConfigSchema = z.object({
  /** Maximum tokens per diff chunk for review sessions */
  maxTokens: z.number().int().positive().default(50000),
  /** Maximum files per diff chunk */
  maxFilesPerChunk: z.number().int().positive().default(20),
  /** Additional file patterns to exclude from diffs */
  excludePatterns: z.array(z.string()).default([]),
  /** Review timeout in milliseconds (default: 30 minutes) */
  reviewTimeoutMs: z.number().int().positive().default(30 * 60 * 1000),
})

/**
 * Complete Zod schema for Scout configuration.
 */
export const ScoutConfigSchema = z.object({
  github: GithubConfigSchema.default({}),
  discovery: DiscoveryConfigSchema.default({}),
  scoring: ScoringConfigSchema.default({}),
  focus: FocusConfigSchema.default({}),
  caching: CachingConfigSchema.default({}),
  rateLimit: RateLimitConfigSchema.default({}),
  watch: WatchConfigSchema.default({}),
})

/**
 * Inferred TypeScript type from the Scout config schema.
 */
export type ScoutConfig = z.infer<typeof ScoutConfigSchema>

/**
 * Partial config type for config files and merging.
 */
export type PartialScoutConfig = z.input<typeof ScoutConfigSchema>

/**
 * Returns the default configuration with all default values applied.
 *
 * @returns The default Scout configuration
 */
export function getDefaultConfig(): ScoutConfig {
  return ScoutConfigSchema.parse({})
}

/**
 * Returns the path to a config file based on type.
 *
 * @param type - Either 'global' for user-wide config or 'project' for local config
 * @param projectRoot - The project root directory (defaults to process.cwd())
 * @returns The absolute path to the config file
 */
export function getConfigPath(type: 'global' | 'project', projectRoot?: string): string {
  if (type === 'global') {
    // XDG config home or fallback to ~/.config
    const configHome = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')
    return join(configHome, 'scout', 'config.json')
  }

  const root = projectRoot ?? process.cwd()
  return join(root, '.scoutrc.json')
}

/**
 * Reads and parses a JSON config file, returning undefined if it doesn't exist or is invalid.
 */
async function readConfigFile(path: string): Promise<PartialScoutConfig | undefined> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as PartialScoutConfig
  } catch {
    // File doesn't exist or is invalid JSON
    return undefined
  }
}

/**
 * Attempts to get GitHub token from gh CLI.
 * Returns undefined if gh is not installed or not authenticated.
 */
async function getGhCliToken(): Promise<string | undefined> {
  try {
    const result = await execa('gh', ['auth', 'token'], { reject: false })
    if (result.exitCode === 0 && result.stdout.trim()) {
      return result.stdout.trim()
    }
  } catch {
    // gh CLI not installed or other error
  }
  return undefined
}

/**
 * Extracts config values from environment variables.
 * Supports GITHUB_TOKEN and SCOUT_* variables.
 * Falls back to gh CLI token if GITHUB_TOKEN is not set.
 */
async function getEnvConfig(): Promise<PartialScoutConfig> {
  const config: PartialScoutConfig = {}

  // GitHub token from environment, with gh CLI fallback
  let githubToken = process.env['GITHUB_TOKEN']
  if (githubToken === undefined) {
    githubToken = await getGhCliToken()
  }
  if (githubToken !== undefined) {
    config.github = { token: githubToken }
  }

  // Discovery section
  const discoveryEnv: Record<string, number | string | string[] | undefined> = {}

  const recencyWindow = process.env['SCOUT_DISCOVERY_RECENCY_WINDOW_DAYS']
  if (recencyWindow !== undefined) {
    const parsed = parseInt(recencyWindow, 10)
    if (!Number.isNaN(parsed)) {
      discoveryEnv['recencyWindowDays'] = parsed
    }
  }

  const maxCandidates = process.env['SCOUT_DISCOVERY_MAX_CANDIDATES_TIER1']
  if (maxCandidates !== undefined) {
    const parsed = parseInt(maxCandidates, 10)
    if (!Number.isNaN(parsed)) {
      discoveryEnv['maxCandidatesTier1'] = parsed
    }
  }

  const cloneBudget = process.env['SCOUT_DISCOVERY_CLONE_BUDGET']
  if (cloneBudget !== undefined) {
    const parsed = parseInt(cloneBudget, 10)
    if (!Number.isNaN(parsed)) {
      discoveryEnv['cloneBudget'] = parsed
    }
  }

  if (Object.keys(discoveryEnv).length > 0) {
    config.discovery = discoveryEnv as PartialScoutConfig['discovery']
  }

  // Caching section
  const cachingEnv: Record<string, number | undefined> = {}

  const ttlHours = process.env['SCOUT_CACHING_TTL_HOURS']
  if (ttlHours !== undefined) {
    const parsed = parseInt(ttlHours, 10)
    if (!Number.isNaN(parsed)) {
      cachingEnv['ttlHours'] = parsed
    }
  }

  const maxPages = process.env['SCOUT_CACHING_MAX_PAGES_PER_LANE']
  if (maxPages !== undefined) {
    const parsed = parseInt(maxPages, 10)
    if (!Number.isNaN(parsed)) {
      cachingEnv['maxPagesPerLane'] = parsed
    }
  }

  if (Object.keys(cachingEnv).length > 0) {
    config.caching = cachingEnv as PartialScoutConfig['caching']
  }

  // Rate limit section
  const rateLimitEnv: Record<string, number | undefined> = {}

  const requestsPerMinute = process.env['SCOUT_RATE_LIMIT_SEARCH_REQUESTS_PER_MINUTE']
  if (requestsPerMinute !== undefined) {
    const parsed = parseInt(requestsPerMinute, 10)
    if (!Number.isNaN(parsed)) {
      rateLimitEnv['searchRequestsPerMinute'] = parsed
    }
  }

  const backoffBase = process.env['SCOUT_RATE_LIMIT_BACKOFF_BASE_MS']
  if (backoffBase !== undefined) {
    const parsed = parseInt(backoffBase, 10)
    if (!Number.isNaN(parsed)) {
      rateLimitEnv['backoffBaseMs'] = parsed
    }
  }

  const backoffMax = process.env['SCOUT_RATE_LIMIT_BACKOFF_MAX_MS']
  if (backoffMax !== undefined) {
    const parsed = parseInt(backoffMax, 10)
    if (!Number.isNaN(parsed)) {
      rateLimitEnv['backoffMaxMs'] = parsed
    }
  }

  if (Object.keys(rateLimitEnv).length > 0) {
    config.rateLimit = rateLimitEnv as PartialScoutConfig['rateLimit']
  }

  // Scoring section
  const scoringEnv: Record<string, number | undefined> = {}

  const wRecency = process.env['SCOUT_SCORING_W_RECENCY']
  if (wRecency !== undefined) {
    const parsed = parseFloat(wRecency)
    if (!Number.isNaN(parsed)) {
      scoringEnv['wRecency'] = parsed
    }
  }

  const wActivity = process.env['SCOUT_SCORING_W_ACTIVITY']
  if (wActivity !== undefined) {
    const parsed = parseFloat(wActivity)
    if (!Number.isNaN(parsed)) {
      scoringEnv['wActivity'] = parsed
    }
  }

  const wLanes = process.env['SCOUT_SCORING_W_LANES']
  if (wLanes !== undefined) {
    const parsed = parseFloat(wLanes)
    if (!Number.isNaN(parsed)) {
      scoringEnv['wLanes'] = parsed
    }
  }

  const wStructural = process.env['SCOUT_SCORING_W_STRUCTURAL']
  if (wStructural !== undefined) {
    const parsed = parseFloat(wStructural)
    if (!Number.isNaN(parsed)) {
      scoringEnv['wStructural'] = parsed
    }
  }

  const wModernity = process.env['SCOUT_SCORING_W_MODERNITY']
  if (wModernity !== undefined) {
    const parsed = parseFloat(wModernity)
    if (!Number.isNaN(parsed)) {
      scoringEnv['wModernity'] = parsed
    }
  }

  if (Object.keys(scoringEnv).length > 0) {
    config.scoring = scoringEnv as PartialScoutConfig['scoring']
  }

  // Focus section
  const focusEnv: Record<string, number | undefined> = {}

  const entrypoints = process.env['SCOUT_FOCUS_ENTRYPOINTS_PER_TARGET']
  if (entrypoints !== undefined) {
    const parsed = parseInt(entrypoints, 10)
    if (!Number.isNaN(parsed)) {
      focusEnv['entrypointsPerTarget'] = parsed
    }
  }

  const maxDirs = process.env['SCOUT_FOCUS_MAX_DIRS_PER_TARGET']
  if (maxDirs !== undefined) {
    const parsed = parseInt(maxDirs, 10)
    if (!Number.isNaN(parsed)) {
      focusEnv['maxDirsPerTarget'] = parsed
    }
  }

  const maxFiles = process.env['SCOUT_FOCUS_MAX_FILES_PER_DIR']
  if (maxFiles !== undefined) {
    const parsed = parseInt(maxFiles, 10)
    if (!Number.isNaN(parsed)) {
      focusEnv['maxFilesPerDir'] = parsed
    }
  }

  if (Object.keys(focusEnv).length > 0) {
    config.focus = focusEnv as PartialScoutConfig['focus']
  }

  return config
}

/**
 * Deep merges multiple partial configs, with later configs taking precedence.
 */
function deepMerge(...configs: (PartialScoutConfig | undefined)[]): PartialScoutConfig {
  const result: PartialScoutConfig = {}

  for (const config of configs) {
    if (config === undefined) continue

    for (const [key, value] of Object.entries(config)) {
      const typedKey = key as keyof PartialScoutConfig
      if (value === undefined) continue

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime type check needed
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        // Merge objects
        const existing = result[typedKey]
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime type check needed
        if (typeof existing === 'object' && !Array.isArray(existing) && existing !== null) {
          result[typedKey] = { ...existing, ...value } as PartialScoutConfig[typeof typedKey]
        } else {
          result[typedKey] = value as PartialScoutConfig[typeof typedKey]
        }
      } else {
        // Override primitives and arrays
        result[typedKey] = value as PartialScoutConfig[typeof typedKey]
      }
    }
  }

  return result
}

/**
 * Loads and merges configuration from all sources.
 *
 * Configuration is loaded and merged in this priority order (highest first):
 * 1. Environment variables (GITHUB_TOKEN, SCOUT_*)
 * 2. Project config (.scoutrc.json in projectRoot)
 * 3. Global config (~/.config/scout/config.json)
 * 4. Default values
 *
 * @param projectRoot - The project root directory for loading .scoutrc.json
 * @returns The merged and validated configuration
 */
export async function loadConfig(projectRoot?: string): Promise<ScoutConfig> {
  // Load configs from files
  const globalConfig = await readConfigFile(getConfigPath('global'))
  const projectConfig = await readConfigFile(getConfigPath('project', projectRoot))

  // Get config from environment (with gh CLI fallback for token)
  const envConfig = await getEnvConfig()

  // Merge configs (later configs override earlier ones)
  const merged = deepMerge(globalConfig, projectConfig, envConfig)

  // Parse through schema to apply defaults and validate
  return ScoutConfigSchema.parse(merged)
}
