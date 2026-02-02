/**
 * Watch track commands - add/list/remove V2 tracked repos.
 * @module commands/watch-track
 */

import { closeDb, insertRepoV2, upsertTrackedV2, listTrackedV2, removeTrackedV2 } from '../watch/db.js'
import { normalizeGitUrl } from '../clone/hardened.js'

export interface WatchAddFlags {
  repo: string
  targetKind?: string
  'target-kind'?: string
  paths: string[]
  intervalHours?: number
  'interval-hours'?: number
  json?: boolean
}

export interface WatchRemoveFlags {
  repo: string
  targetKind?: string
  'target-kind'?: string
  json?: boolean
}

export async function runWatchAdd(flags: WatchAddFlags): Promise<void> {
  try {
    const targetKind = flags.targetKind ?? flags['target-kind']
    if (targetKind === undefined) {
      throw new Error('Missing target kind')
    }

    const intervalHours = flags.intervalHours ?? flags['interval-hours']
    const url = normalizeGitUrl(flags.repo)
    const repoId = await insertRepoV2({
      fullName: flags.repo,
      url,
      defaultBranch: null,
      licenseSpdx: null,
    })

    await upsertTrackedV2({
      repoId,
      targetKind,
      trackedPaths: flags.paths,
      enabled: true,
      intervalHours: intervalHours ?? 24,
    })

    if (flags.json === true) {
      console.log(JSON.stringify({
        action: 'add',
        repo: flags.repo,
        repoUrl: url,
        targetKind,
        paths: flags.paths,
        intervalHours: intervalHours ?? 24,
      }))
    } else {
      console.log(`Added ${flags.repo} (${targetKind})`)
    }
  } finally {
    closeDb()
  }
}

export interface WatchListFlags {
  json?: boolean
  format?: string
}

export async function runWatchList(flags: WatchListFlags = {}): Promise<void> {
  try {
    const rows = await listTrackedV2()
    if (flags.json === true || flags.format === 'json') {
      console.log(JSON.stringify(rows))
      return
    }

    if (rows.length === 0) {
      console.log('No tracked repos.')
      return
    }

    console.log('Repo\tKind\tPaths\tInterval(h)\tEnabled')
    for (const row of rows) {
      console.log(`${row.repoFullName}\t${row.targetKind}\t${row.trackedPaths.join(',')}\t${row.intervalHours}\t${row.enabled}`)
    }
  } finally {
    closeDb()
  }
}

export async function runWatchRemove(flags: WatchRemoveFlags): Promise<void> {
  try {
    const targetKind = flags.targetKind ?? flags['target-kind']
    if (targetKind === undefined) {
      throw new Error('Missing target kind')
    }

    const removed = await removeTrackedV2(flags.repo, targetKind)
    if (flags.json === true) {
      console.log(JSON.stringify({
        action: 'remove',
        repo: flags.repo,
        targetKind,
        removed,
      }))
      return
    }

    if (removed) {
      console.log(`Removed ${flags.repo} (${targetKind})`)
    } else {
      console.log(`No tracked entry for ${flags.repo} (${targetKind})`)
    }
  } finally {
    closeDb()
  }
}
