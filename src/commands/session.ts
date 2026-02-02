/**
 * Session command - Generate review session directories.
 * @module commands/session
 *
 * Creates a complete review session with:
 * - Git worktree at new SHA
 * - Hygienic diff (chunked if large)
 * - Review instructions aligned to Trail of Bits differential-review skill
 */

import { resolve } from 'node:path'
import { generateSession } from '../watch/session.js'
import { withWatchLock } from '../watch/lock.js'
import { closeDb } from '../watch/db.js'
import type { ComponentKind } from '../schemas/targets.js'

export interface SessionFlags {
  repo: string
  kind?: string
  maxTokens?: number
  out?: string
}

const validKinds: ComponentKind[] = ['mcp-server', 'cli', 'skill', 'hook', 'plugin', 'library']

export async function runSession(flags: SessionFlags): Promise<void> {
  try {
    const repo = flags.repo

    // Validate kind if provided
    let targetKind: ComponentKind | undefined
    if (flags.kind !== undefined) {
      if (!validKinds.includes(flags.kind as ComponentKind)) {
        console.error(`❌ Invalid component kind: ${flags.kind}`)
        console.error(`   Valid kinds: ${validKinds.join(', ')}`)
        process.exit(1)
      }
      targetKind = flags.kind as ComponentKind
    }

    console.log(`📁 Generating review session for ${repo}...`)

    await withWatchLock(async () => {
      try {
        const result = await generateSession({
          repo,
          targetKind,
          maxTokens: flags.maxTokens,
          outputDir: flags.out !== undefined ? resolve(flags.out) : undefined,
        })

        if (!result.isNew) {
          console.log(`ℹ️  Session already exists:`)
          console.log(`   ${result.sessionPath}`)
          console.log('')
          console.log('Run the review with:')
          console.log(`  scout review run --session ${result.sessionPath}`)
          return
        }

        console.log('')
        console.log('✅ Session created:')
        console.log(`   ${result.sessionPath}`)
        console.log('')
        console.log('Session details:')
        console.log(`   SHA range: ${result.oldSha.slice(0, 7)} → ${result.newSha.slice(0, 7)}`)
        console.log(`   Chunks: ${result.chunkCount}`)
        console.log(`   Tokens: ~${result.estimatedTokens}`)
        if (result.hasDrift) {
          console.log('   ⚠️  Drift detected (see DRIFT.md)')
        }
        console.log('')
        console.log('Session contents:')
        console.log('   repo/                    # Git worktree at new SHA')
        console.log(result.chunkCount === 1
          ? '   diff.patch              # Hygienic diff'
          : '   chunks/                 # Diff chunks')
        console.log('   review_context.json     # Machine-readable context')
        console.log('   REVIEW_INSTRUCTIONS.md  # Review guide')
        if (result.hasDrift) {
          console.log('   DRIFT.md                # Path drift report')
        }
        console.log('   OUTPUT/                 # Write report here')
        console.log('')
        console.log('Next step - run the review:')
        console.log(`  scout review run --session ${result.sessionPath}`)

      } catch (error) {
        console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`)
        process.exit(1)
      }
    })
  } finally {
    closeDb()
  }
}
