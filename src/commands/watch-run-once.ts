/**
 * Watch run-once command - process tracked repos for differential review.
 * @module commands/watch-run-once
 */

import { runWatchOnce } from '../watch/run-once.js'
import { closeDb } from '../watch/db.js'
import { fetchRemoteHead } from '../watch/remote.js'
import { createWatchSession } from '../watch/session-watch.js'
import { loadConfig } from '../config.js'
import { launchReview } from '../review/launcher.js'

export interface WatchRunOnceFlags {
  sinceLast?: boolean
  autoReview?: boolean
  json?: boolean
  format?: string
}

export async function runWatchRunOnce(flags: WatchRunOnceFlags): Promise<void> {
  try {
    const config = await loadConfig(process.cwd())
    const watchConfig = config.watch
    const useJson = flags.json === true || flags.format === 'json'

    await runWatchOnce({
      sinceLast: flags.sinceLast === true,
      autoReview: flags.autoReview === true,
      fetchHead: async (repo) => fetchRemoteHead(repo.url),
      onSessionCreated: async (sessionPath) => {
        if (useJson) {
          console.log(JSON.stringify({
            sessionPath,
          }))
        }
        if (flags.autoReview === true) {
          await launchReview({
            sessionPath,
            interactive: false,
            timeout: watchConfig.reviewTimeoutMs,
          })
        }
      },
      createSession: async (input) => {
        const result = await createWatchSession({
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
    closeDb()
  }
}
