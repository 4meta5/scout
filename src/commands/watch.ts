/**
 * Watch command - Fetch updates and detect changes in tracked repos.
 * @module commands/watch
 *
 * Performs hardened git fetch for all tracked repos and reports
 * which repos have pending changes for review.
 */

import {
  fetchAllRepos,
  runFetchWithLock,
} from '../watch/fetch.js'
import {
  getAllTrackedRepos,
  getTrackedRepoByName,
  closeDb,
} from '../watch/db.js'

export interface WatchFlags {
  repo?: string
  all?: boolean
}

export async function runWatch(flags: WatchFlags): Promise<void> {
  try {
    await runFetchWithLock(async () => {
      // Fetch single repo if specified
      if (flags.repo !== undefined) {
        const tracked = await getTrackedRepoByName(flags.repo)

        if (tracked === null) {
          console.error(`❌ Error: Repo "${flags.repo}" is not tracked`)
          console.error('   Track it first with: scout track --repo ' + flags.repo)
          process.exit(1)
        }

        console.log(`🔄 Fetching updates for ${flags.repo}...`)
        const { fetchRepo } = await import('../watch/fetch.js')
        const result = await fetchRepo(tracked)

        if (result.error !== undefined) {
          console.error(`❌ Error fetching ${result.repo}: ${result.error}`)
          process.exit(1)
        }

        if (result.hasChanges) {
          console.log(`⚡ Changes detected!`)
          console.log(`   Old: ${result.oldSha?.slice(0, 7) ?? 'unknown'}`)
          console.log(`   New: ${result.newSha.slice(0, 7)}`)
          console.log('')
          console.log('Generate review session with:')
          console.log(`  scout session ${result.repo}`)
        } else {
          console.log(`✓ No changes since last fetch`)
          console.log(`   SHA: ${result.newSha.slice(0, 7)}`)
        }
        return
      }

      // Fetch all tracked repos
      if (flags.all !== true) {
        console.log('Usage: scout watch --all')
        console.log('       scout watch --repo owner/name')
        return
      }

      const repos = await getAllTrackedRepos()

      if (repos.length === 0) {
        console.log('No repos currently tracked.')
        console.log('')
        console.log('Track repos with:')
        console.log('  scout track --validated .scout/validate-summary.json --all')
        return
      }

      console.log(`🔄 Fetching updates for ${repos.length} tracked repos...`)
      console.log('')

      const results = await fetchAllRepos()

      // Report results
      const changed = results.filter(r => r.hasChanges)
      const unchanged = results.filter(r => !r.hasChanges && r.error === undefined)
      const errors = results.filter(r => r.error !== undefined)

      for (const r of results) {
        if (r.error !== undefined) {
          console.log(`  ❌ ${r.repo}: ${r.error}`)
        } else if (r.hasChanges) {
          console.log(`  ⚡ ${r.repo}: ${r.oldSha?.slice(0, 7) ?? '?'} → ${r.newSha.slice(0, 7)}`)
        } else {
          console.log(`  ✓ ${r.repo}: ${r.newSha.slice(0, 7)} (no changes)`)
        }
      }

      console.log('')
      console.log('📊 Summary:')
      console.log(`  Changed:   ${changed.length}`)
      console.log(`  Unchanged: ${unchanged.length}`)
      if (errors.length > 0) {
        console.log(`  Errors:    ${errors.length}`)
      }

      if (changed.length > 0) {
        console.log('')
        console.log('Generate review sessions with:')
        for (const r of changed) {
          console.log(`  scout session ${r.repo}`)
        }
      }
    })
  } finally {
    closeDb()
  }
}
