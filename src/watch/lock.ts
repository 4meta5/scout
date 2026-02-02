/**
 * Process-level file locking for watch operations.
 * @module watch/lock
 *
 * Prevents concurrent watch/session operations on the same database.
 * Uses proper-lockfile for cross-platform file locking.
 */

import lockfile from 'proper-lockfile'
import { join } from 'node:path'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { getWatchDbDir } from './db.js'

/**
 * Lock file name for watch operations.
 */
const LOCK_FILE_NAME = 'scout.lock'

/**
 * Gets the path to the lock file.
 */
export function getLockFilePath(): string {
  return join(getWatchDbDir(), LOCK_FILE_NAME)
}

/**
 * Ensures the lock file exists (required by proper-lockfile).
 */
async function ensureLockFile(): Promise<string> {
  const lockDir = getWatchDbDir()
  await mkdir(lockDir, { recursive: true })

  const lockPath = getLockFilePath()

  // Check if file exists, create if not
  try {
    await access(lockPath)
  } catch {
    await writeFile(lockPath, '')
  }

  return lockPath
}

/**
 * Lock options for proper-lockfile.
 */
const LOCK_OPTIONS = {
  stale: 30000, // Consider lock stale after 30 seconds
  retries: {
    retries: 5,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 1000,
    randomize: true,
  },
}

/**
 * Result of acquiring a lock.
 */
export interface LockHandle {
  /** Release the lock */
  release: () => Promise<void>
}

/**
 * Acquires an exclusive lock for watch operations.
 * Returns a handle that must be used to release the lock.
 *
 * @throws Error if lock cannot be acquired (another process holds it)
 *
 * @example
 * ```ts
 * const lock = await acquireWatchLock()
 * try {
 *   // Perform watch operations
 * } finally {
 *   await lock.release()
 * }
 * ```
 */
export async function acquireWatchLock(): Promise<LockHandle> {
  const lockPath = await ensureLockFile()

  const release = await lockfile.lock(lockPath, LOCK_OPTIONS)

  return {
    release: async () => {
      await release()
    },
  }
}

/**
 * Checks if the watch lock is currently held by another process.
 */
export async function isWatchLocked(): Promise<boolean> {
  const lockPath = await ensureLockFile()

  try {
    return await lockfile.check(lockPath, { stale: LOCK_OPTIONS.stale })
  } catch {
    // File doesn't exist or other error - not locked
    return false
  }
}

/**
 * Executes a function with the watch lock held.
 * Automatically acquires and releases the lock.
 *
 * @param fn The function to execute while holding the lock
 * @returns The result of the function
 *
 * @example
 * ```ts
 * const result = await withWatchLock(async () => {
 *   // Perform watch operations
 *   return someValue
 * })
 * ```
 */
export async function withWatchLock<T>(fn: () => Promise<T>): Promise<T> {
  const lock = await acquireWatchLock()
  try {
    return await fn()
  } finally {
    await lock.release()
  }
}
