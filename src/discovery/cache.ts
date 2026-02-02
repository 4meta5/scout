/**
 * API response caching for discovery.
 * @module discovery/cache
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { getApiCachePath } from '../cache.js'

interface CacheEntry<T> {
  timestamp: string
  ttlHours: number
  data: T
}

/**
 * Generates a hash for a cache key.
 */
export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

/**
 * Checks if a cache entry is still valid.
 */
function isValid<T>(entry: CacheEntry<T>): boolean {
  const now = Date.now()
  const entryTime = new Date(entry.timestamp).getTime()
  const ttlMs = entry.ttlHours * 60 * 60 * 1000
  return now - entryTime < ttlMs
}

/**
 * Gets a cached value if it exists and is valid.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const hash = hashKey(key)
  const path = getApiCachePath(hash)

  try {
    const content = await readFile(path, 'utf-8')
    const entry = JSON.parse(content) as CacheEntry<T>

    if (isValid(entry)) {
      return entry.data
    }
  } catch {
    // Cache miss or invalid JSON
  }

  return null
}

/**
 * Sets a cached value with TTL.
 */
export async function setCached(key: string, data: unknown, ttlHours: number): Promise<void> {
  const hash = hashKey(key)
  const path = getApiCachePath(hash)

  const entry: CacheEntry<unknown> = {
    timestamp: new Date().toISOString(),
    ttlHours,
    data,
  }

  // Ensure cache directory exists
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(entry, null, 2))
}

/**
 * Checks if a cache entry exists and is valid without reading full data.
 */
export async function hasCached(key: string, ttlHours: number): Promise<boolean> {
  const hash = hashKey(key)
  const path = getApiCachePath(hash)

  try {
    const s = await stat(path)
    const ageHours = (Date.now() - s.mtime.getTime()) / (60 * 60 * 1000)
    return ageHours < ttlHours
  } catch {
    return false
  }
}
