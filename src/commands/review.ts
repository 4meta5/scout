/**
 * Review command - Launch claude CLI for differential review.
 * @module commands/review
 *
 * Subcommands:
 * - scout review run --session <path>  : Launch interactive review
 * - scout review skip --session <path> : Skip a pending review
 * - scout review list                  : List pending reviews
 */

import { resolve } from 'node:path'
import {
  launchReview,
  skipReview,
  isClaudeAvailable,
  validateSession,
} from '../review/launcher.js'
import {
  getPendingReviewSessions,
  getTrackedRepoById,
  closeDb,
} from '../watch/db.js'
import { withWatchLock } from '../watch/lock.js'

export interface ReviewFlags {
  session?: string
  run?: boolean
  skip?: boolean
  list?: boolean
}

export async function runReview(flags: ReviewFlags): Promise<void> {
  try {
    // List pending reviews
    if (flags.list === true) {
      const pending = await getPendingReviewSessions()

      if (pending.length === 0) {
        console.log('No pending reviews.')
        console.log('')
        console.log('Generate a review session with:')
        console.log('  scout session <owner/repo>')
        return
      }

      console.log(`📋 Pending reviews (${pending.length}):`)
      console.log('')

      for (const session of pending) {
        const repo = await getTrackedRepoById(session.repoId)
        const repoName = repo?.repo ?? 'unknown'
        const sha = `${session.oldSha.slice(0, 7)} → ${session.newSha.slice(0, 7)}`
        const kind = session.targetKind ?? 'all'

        console.log(`  ${repoName} (${kind})`)
        console.log(`    SHA: ${sha}`)
        console.log(`    Chunks: ${session.chunkCount}`)
        console.log(`    Path: ${session.sessionPath}`)
        console.log('')
      }

      console.log('Run a review with:')
      console.log('  scout review run --session <path>')
      return
    }

    // Require session path for run/skip
    if (flags.session === undefined) {
      console.error('Usage:')
      console.error('  scout review run --session <path>   # Run a review')
      console.error('  scout review skip --session <path>  # Skip a review')
      console.error('  scout review list                   # List pending reviews')
      process.exit(1)
    }

    const sessionPath = resolve(flags.session)

    // Skip mode
    if (flags.skip === true) {
      await withWatchLock(async () => {
        await skipReview(sessionPath)
        console.log(`⏭️  Skipped review: ${sessionPath}`)
      })
      return
    }

    const shouldRun = flags.run === true || (flags.run !== true && flags.skip !== true)

    // Run mode (default if session provided)
    if (shouldRun) {
      // Check claude availability
      const available = await isClaudeAvailable()
      if (!available) {
        console.error('❌ claude CLI not found')
        console.error('')
        console.error('Install with:')
        console.error('  npm install -g @anthropic-ai/claude-code')
        process.exit(1)
      }

      // Validate session
      const validation = await validateSession(sessionPath)
      if (!validation.valid) {
        console.error(`❌ Invalid session: ${validation.error}`)
        process.exit(1)
      }

      console.log(`🔍 Launching review for: ${sessionPath}`)
      console.log('')
      console.log('Claude will:')
      console.log('  1. Read REVIEW_INSTRUCTIONS.md')
      console.log('  2. Analyze the diff in repo/')
      console.log('  3. Write findings to OUTPUT/DIFFERENTIAL_REVIEW_REPORT.md')
      console.log('')
      console.log('Starting claude...')
      console.log('')

      const result = await launchReview({
        sessionPath,
        interactive: true,
      })

      console.log('')

      if (result.success) {
        console.log('✅ Review completed successfully')
        console.log('')
        console.log('Review report:')
        console.log(`  ${sessionPath}/OUTPUT/DIFFERENTIAL_REVIEW_REPORT.md`)
      } else {
        console.error(`❌ Review failed: ${result.error}`)
        console.error(`   Exit code: ${result.exitCode}`)
        process.exit(result.exitCode)
      }
    }
  } finally {
    closeDb()
  }
}
