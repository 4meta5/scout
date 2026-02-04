/**
 * Proxy loader for @4meta5/scout-watch package.
 * @module commands/watch-proxy
 *
 * This module provides dynamic import of the optional @4meta5/scout-watch package,
 * with helpful error messages when it's not installed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Type representing the scout-watch module interface.
 * Using 'any' for flexibility since the package may not be installed.
 *
 * NOTE: Keep this interface minimal. Only add functions that CLI commands
 * actually call. Internal scout-watch functions should not be exposed here.
 */
export interface ScoutWatchModule {
  // Watch exports
  fetchAllRepos: () => Promise<any[]>
  fetchRepo: (tracked: any) => Promise<any>
  runFetchWithLock: (fn: () => Promise<void>) => Promise<void>
  getAllTrackedRepos: () => Promise<any[]>
  getTrackedRepoByName: (name: string) => Promise<any | null>
  getTrackedRepoById: (id: number) => Promise<any | null>
  closeDb: () => void
  insertRepoV2: (input: any) => Promise<number>
  upsertTrackedV2: (input: any) => Promise<number>
  listTrackedV2: () => Promise<any[]>
  removeTrackedV2: (repoFullName: string, targetKind: string) => Promise<boolean>
  runWatchOnce: (deps: any) => Promise<void>
  fetchRemoteHead: (url: string) => Promise<string>
  createWatchSession: (input: any) => Promise<any>
  generateSession: (options: any) => Promise<any>
  withWatchLock: (fn: () => Promise<void>) => Promise<void>
  loadValidationSummary: (path: string) => Promise<any>
  trackFromValidationSummary: (summary: any, options: any) => Promise<any[]>
  trackSingleRepo: (summary: any, repo: string) => Promise<any>
  listTrackedRepos: () => Promise<any[]>
  runTrackWithLock: (fn: () => Promise<void>) => Promise<void>
  getPendingReviewSessions: () => Promise<any[]>
  // Review exports
  launchReview: (options: any) => Promise<any>
  skipReview: (sessionPath: string) => Promise<void>
  isClaudeAvailable: () => Promise<boolean>
  validateSession: (sessionPath: string) => Promise<{ valid: boolean; error?: string }>
}

let cachedModule: ScoutWatchModule | null = null

/**
 * Attempts to load the @4meta5/scout-watch package.
 * Returns null if the package is not installed.
 */
export async function loadScoutWatch(): Promise<ScoutWatchModule | null> {
  if (cachedModule !== null) {
    return cachedModule
  }

  try {
    // @ts-expect-error - Optional package may not be installed
    const mod = await import('@4meta5/scout-watch')
    cachedModule = mod as unknown as ScoutWatchModule
    return cachedModule
  } catch {
    return null
  }
}

/**
 * Prints a helpful error message explaining how to install @4meta5/scout-watch.
 */
export function printInstallPrompt(): void {
  console.error('')
  console.error('  Watch/review features require @4meta5/scout-watch.')
  console.error('')
  console.error('  Install with:')
  console.error('    npm install @4meta5/scout-watch')
  console.error('')
}

/**
 * Loads scout-watch and exits with an error if not available.
 */
export async function requireScoutWatch(): Promise<ScoutWatchModule> {
  const mod = await loadScoutWatch()
  if (mod === null) {
    printInstallPrompt()
    process.exit(1)
  }
  return mod
}
