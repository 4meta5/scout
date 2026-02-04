/**
 * Watch run-once command - process tracked repos for differential review.
 * @module commands/watch-run-once
 */

import { loadConfig } from '../config.js'
import { requireScoutWatch } from './watch-proxy.js'
import { warnExperimental } from './experimental-warning.js'

export interface WatchRunOnceFlags {
  sinceLast?: boolean
  autoReview?: boolean
  json?: boolean
  format?: string
}

export async function runWatchRunOnce(flags: WatchRunOnceFlags): Promise<void> {
  const watch = await requireScoutWatch()
  warnExperimental('watch')

  try {
    const config = await loadConfig(process.cwd())
    const watchConfig = config.watch
    const useJson = flags.json === true || flags.format === 'json'

    await watch.runWatchOnce({
      sinceLast: flags.sinceLast === true,
      autoReview: flags.autoReview === true,
      fetchHead: async (repo: { url: string }) => watch.fetchRemoteHead(repo.url),
      onSessionCreated: async (sessionPath: string) => {
        if (useJson) {
          console.log(JSON.stringify({
            sessionPath,
          }))
        }
        if (flags.autoReview === true) {
          await watch.launchReview({
            sessionPath,
            interactive: false,
            timeout: watchConfig.reviewTimeoutMs,
          })
        }
      },
      createSession: async (input: {
        repoFullName: string
        repoUrl: string
        fromSha: string
        toSha: string
        targetKind: string
        trackedPaths: string[]
      }) => {
        const result = await watch.createWatchSession({
          repoFullName: input.repoFullName,
          repoUrl: input.repoUrl,
          oldSha: input.fromSha,
          newSha: input.toSha,
          targetKind: input.targetKind,
          trackedPaths: input.trackedPaths,
          maxTokens: watchConfig.maxTokens,
          maxFilesPerChunk: watchConfig.maxFilesPerChunk,
          excludePatterns: watchConfig.excludePatterns,
        })
        if (useJson) {
          console.log(JSON.stringify({
            sessionPath: result.sessionPath,
            driftFlag: result.driftFlag,
            diffStats: result.diffStats,
          }))
        }
        return result
      },
    })
  } finally {
    watch.closeDb()
  }
}
