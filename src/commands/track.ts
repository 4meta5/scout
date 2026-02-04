/**
 * Track command - Add validated repos to watch list.
 * @module commands/track
 *
 * Adds repos from validate-summary.json to the SQLite tracking database
 * with their focus roots and entrypoints for drift detection.
 */

import { join, resolve } from 'node:path'
import { requireScoutWatch } from './watch-proxy.js'
import { warnExperimental } from './experimental-warning.js'

export interface TrackFlags {
  validated?: string
  repo?: string
  all?: boolean
  list?: boolean
}

export async function runTrack(flags: TrackFlags): Promise<void> {
  const watch = await requireScoutWatch()
  warnExperimental('track')

  try {
    // List mode
    if (flags.list === true) {
      const repos = await watch.listTrackedRepos()

      if (repos.length === 0) {
        console.log('No repos currently tracked.')
        console.log('')
        console.log('Track repos with:')
        console.log('  scout track --validated .scout/validate-summary.json --all')
        return
      }

      console.log(`Tracked repositories (${repos.length}):`)
      console.log('')

      for (const repo of repos) {
        const score = Math.round(repo.tier2Score * 100)
        const status = repo.hasChanges ? '[changes pending]' : '[up to date]'
        console.log(`  ${repo.repo} (${score}%) - ${status}`)
        console.log(`    baseline: ${repo.baselineSha.slice(0, 7)}`)
        if (repo.lastSha !== null) {
          console.log(`    latest:   ${repo.lastSha.slice(0, 7)}`)
        }
      }

      console.log('')
      console.log('Fetch updates with: scout watch --all')
      return
    }

    // Determine validation summary path
    const validatedPath = flags.validated ?? join(process.cwd(), '.scout', 'validate-summary.json')
    const summaryPath = resolve(validatedPath)

    // Load validation summary
    let summary
    try {
      summary = await watch.loadValidationSummary(summaryPath)
      console.log(`Loaded validation summary: ${summary.totalValidated} repos`)
    } catch {
      console.error(`Error: Could not load validation summary from ${summaryPath}`)
      console.error('   Run "scout validate" first')
      process.exit(1)
    }

    // Track with lock
    await watch.runTrackWithLock(async () => {
      // Track single repo if specified
      if (flags.repo !== undefined) {
        const result = await watch.trackSingleRepo(summary, flags.repo)

        if (result.status === 'added') {
          console.log(`Tracked: ${result.repo}`)
        } else if (result.status === 'exists') {
          console.log(`Already tracked: ${result.repo}`)
        } else {
          console.log(`Skipped: ${result.repo} - ${result.reason}`)
        }
        return
      }

      // Track multiple repos
      const trackAll = flags.all === true
      const results = await watch.trackFromValidationSummary(summary, { trackAll })

      // Report results
      type TrackResult = { repo: string; status: 'added' | 'exists' | 'skipped'; reason?: string }
      const added = results.filter((r: TrackResult) => r.status === 'added')
      const exists = results.filter((r: TrackResult) => r.status === 'exists')
      const skipped = results.filter((r: TrackResult) => r.status === 'skipped')

      console.log('')
      console.log('Track results:')

      if (added.length > 0) {
        console.log(`  Added: ${added.length}`)
        for (const r of added) {
          console.log(`     - ${r.repo}`)
        }
      }

      if (exists.length > 0) {
        console.log(`  Already tracked: ${exists.length}`)
        for (const r of exists) {
          console.log(`     - ${r.repo}`)
        }
      }

      if (skipped.length > 0) {
        console.log(`  Skipped: ${skipped.length}`)
        for (const r of skipped) {
          console.log(`     - ${r.repo}: ${r.reason}`)
        }
      }

      console.log('')
      console.log('Next steps:')
      console.log('  scout watch --all    # Fetch updates for all tracked repos')
      console.log('  scout track --list   # List tracked repos')
    })
  } finally {
    watch.closeDb()
  }
}
