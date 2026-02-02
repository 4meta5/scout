/**
 * Hardened fetch operations for watch mode.
 * @module watch/fetch
 *
 * Uses the same security measures as clone (hooks disabled).
 */

import { execa } from 'execa'
import {
  getAllTrackedRepos,
  getTrackedRepoById,
  updateTrackedRepoSha,
  getTrackedReposWithChanges,
} from './db.js'
import { withWatchLock } from './lock.js'
import type { TrackedRepo } from '../schemas/watch.js'

/**
 * Base git options that disable hooks for security.
 */
const GIT_SAFE_OPTIONS = ['-c', 'core.hooksPath=/dev/null']

/**
 * Result of a fetch operation.
 */
export interface FetchResult {
  repo: string
  oldSha: string | null
  newSha: string
  hasChanges: boolean
  error?: string
}

/**
 * Fetch updates for a single tracked repo.
 * Uses shallow fetch with hooks disabled.
 */
export async function fetchRepo(tracked: TrackedRepo): Promise<FetchResult> {
  const previousSha = tracked.lastSha ?? tracked.baselineSha

  try {
    // Fetch latest from remote with depth 1
    await execa('git', [
      ...GIT_SAFE_OPTIONS,
      'fetch',
      '--depth', '1',
      'origin',
    ], { cwd: tracked.localPath })

    // Get the latest remote HEAD SHA
    const result = await execa('git', [
      ...GIT_SAFE_OPTIONS,
      'rev-parse',
      'origin/HEAD',
    ], { cwd: tracked.localPath })

    const newSha = result.stdout.trim()

    // Update database with new SHA
    await updateTrackedRepoSha(tracked.id, newSha)

    return {
      repo: tracked.repo,
      oldSha: previousSha,
      newSha,
      hasChanges: newSha !== previousSha,
    }
  } catch (error) {
    // Try alternative: use FETCH_HEAD
    try {
      const fetchHead = await execa('git', [
        ...GIT_SAFE_OPTIONS,
        'rev-parse',
        'FETCH_HEAD',
      ], { cwd: tracked.localPath })

      const newSha = fetchHead.stdout.trim()
      await updateTrackedRepoSha(tracked.id, newSha)

      return {
        repo: tracked.repo,
        oldSha: previousSha,
        newSha,
        hasChanges: newSha !== previousSha,
      }
    } catch {
      return {
        repo: tracked.repo,
        oldSha: previousSha,
        newSha: previousSha,
        hasChanges: false,
        error: error instanceof Error ? error.message : 'Unknown fetch error',
      }
    }
  }
}

/**
 * Fetch updates for all tracked repos.
 */
export async function fetchAllRepos(): Promise<FetchResult[]> {
  const repos = await getAllTrackedRepos()
  const results: FetchResult[] = []

  for (const repo of repos) {
    const result = await fetchRepo(repo)
    results.push(result)
  }

  return results
}

/**
 * Fetch updates for a specific repo by ID.
 */
export async function fetchRepoById(id: number): Promise<FetchResult | null> {
  const repo = await getTrackedRepoById(id)
  if (repo === null) return null
  return fetchRepo(repo)
}

/**
 * Get repos with pending changes (SHA differs from baseline).
 */
export async function getReposWithPendingChanges(): Promise<TrackedRepo[]> {
  return getTrackedReposWithChanges()
}

/**
 * Checkout a specific commit in a repo's worktree.
 * Used for creating review session worktrees.
 */
export async function checkoutSha(repoPath: string, sha: string): Promise<void> {
  await execa('git', [
    ...GIT_SAFE_OPTIONS,
    'checkout',
    sha,
  ], { cwd: repoPath })
}

/**
 * Create a git worktree at a specific SHA.
 * Worktrees allow multiple checkouts from the same repo.
 */
export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  sha: string
): Promise<void> {
  // First, fetch enough history to have the target SHA
  try {
    await execa('git', [
      ...GIT_SAFE_OPTIONS,
      'fetch',
      '--depth', '100',
      'origin',
      sha,
    ], { cwd: repoPath })
  } catch {
    // Fetch might fail if SHA is already available or too old
    // Continue anyway
  }

  // Create the worktree
  await execa('git', [
    ...GIT_SAFE_OPTIONS,
    'worktree', 'add',
    '--detach',
    worktreePath,
    sha,
  ], { cwd: repoPath })
}

/**
 * Remove a git worktree.
 */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await execa('git', [
    ...GIT_SAFE_OPTIONS,
    'worktree', 'remove',
    '--force',
    worktreePath,
  ], { cwd: repoPath })
}

/**
 * Run fetch command with lock.
 */
export async function runFetchWithLock<T>(fn: () => Promise<T>): Promise<T> {
  return withWatchLock(fn)
}
