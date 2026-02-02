/**
 * Cache path management for Scout CLI.
 *
 * Uses XDG-compliant paths via env-paths for storing:
 * - Cloned repositories
 * - API response caches
 * - Run artifacts
 *
 * @module cache
 */

import envPaths from 'env-paths'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

/**
 * XDG-compliant paths for the 'scout' application.
 * Uses no suffix for cleaner directory names.
 */
const paths = envPaths('scout', { suffix: '' })

/**
 * Valid cache type identifiers.
 */
export type CacheType = 'repos' | 'api' | 'runs'

/**
 * Returns the cache directory path for a given cache type.
 *
 * @param type - The type of cache ('repos', 'api', or 'runs')
 * @returns The absolute path to the cache directory
 *
 * @example
 * ```ts
 * getCachePath('repos')  // ~/Library/Caches/scout/repos (macOS)
 * getCachePath('api')    // ~/Library/Caches/scout/api (macOS)
 * getCachePath('runs')   // ~/Library/Caches/scout/runs (macOS)
 * ```
 */
export function getCachePath(type: CacheType): string {
  return join(paths.cache, type)
}

/**
 * Returns the cache path for a specific repository.
 *
 * @param owner - The repository owner (user or organization)
 * @param repo - The repository name
 * @returns The absolute path where the repo should be cached
 *
 * @example
 * ```ts
 * getRepoCachePath('anthropics', 'claude-code')
 * // ~/Library/Caches/scout/repos/anthropics/claude-code (macOS)
 * ```
 */
export function getRepoCachePath(owner: string, repo: string): string {
  return join(getCachePath('repos'), owner, repo)
}

/**
 * Returns the cache path for an API query result.
 *
 * @param queryHash - A unique hash identifying the query
 * @returns The absolute path to the cached API response file
 *
 * @example
 * ```ts
 * getApiCachePath('abc123def456')
 * // ~/Library/Caches/scout/api/abc123def456.json (macOS)
 * ```
 */
export function getApiCachePath(queryHash: string): string {
  return join(getCachePath('api'), `${queryHash}.json`)
}

/**
 * Returns the directory path for a specific run's artifacts.
 *
 * @param runId - A unique identifier for the run
 * @returns The absolute path to the run's output directory
 *
 * @example
 * ```ts
 * getRunPath('run-2024-01-15-abc123')
 * // ~/Library/Caches/scout/runs/run-2024-01-15-abc123 (macOS)
 * ```
 */
export function getRunPath(runId: string): string {
  return join(getCachePath('runs'), runId)
}

/**
 * Ensures a cache directory exists, creating it recursively if needed.
 *
 * @param path - The directory path to ensure exists
 * @returns A promise that resolves when the directory exists
 *
 * @example
 * ```ts
 * await ensureCacheDir(getRepoCachePath('owner', 'repo'))
 * ```
 */
export async function ensureCacheDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

/**
 * Returns the base cache path used by env-paths.
 * Useful for debugging and displaying cache location to users.
 *
 * @returns The base cache directory path
 */
export function getBaseCachePath(): string {
  return paths.cache
}

/**
 * Returns the data path for persistent data storage.
 * Uses XDG data directory.
 *
 * @returns The base data directory path
 */
export function getDataPath(): string {
  return paths.data
}

/**
 * Returns the config path for configuration files.
 * Uses XDG config directory.
 *
 * @returns The base config directory path
 */
export function getConfigBasePath(): string {
  return paths.config
}
