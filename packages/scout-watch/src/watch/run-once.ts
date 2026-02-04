/**
 * Watch run-once - process tracked repos and create review sessions.
 * @module watch/run-once
 */

import { getDb } from './db.js'

export interface RunOnceDeps {
  fetchHead: (repo: { id: number; full_name: string; url: string }) => Promise<string>
  createSession: (input: {
    repoFullName: string
    repoUrl: string
    fromSha: string
    toSha: string
    targetKind: string
    trackedPaths: string[]
  }) => Promise<{ sessionPath: string; driftFlag?: boolean; diffStats?: { filesChanged: number; insertions: number; deletions: number } }>
  sinceLast?: boolean
  autoReview?: boolean
  onSessionCreated?: (sessionPath: string) => Promise<void> | void
}

export async function runWatchOnce(deps: RunOnceDeps): Promise<void> {
  const db = await getDb()
  const sinceLast = deps.sinceLast === true
  const autoReview = deps.autoReview === true

  const trackedRows = db.prepare(`
    SELECT t.id as tracked_id, t.repo_id, t.target_kind, t.tracked_paths_json,
           r.full_name, r.url
    FROM tracked t
    JOIN repos r ON r.id = t.repo_id
    WHERE t.enabled = 1
  `).all() as Array<{
    tracked_id: number
    repo_id: number
    target_kind: string
    tracked_paths_json: string
    full_name: string
    url: string
  }>

  const getLatestSnapshot = db.prepare(`
    SELECT head_sha FROM snapshots WHERE repo_id = ? ORDER BY id DESC LIMIT 1
  `)

  const insertChange = db.prepare(`
    INSERT INTO changes (repo_id, from_sha, to_sha, target_kind, diff_stats_json, drift_flag)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const insertSession = db.prepare(`
    INSERT INTO sessions (change_id, session_path, status)
    VALUES (?, ?, 'pending')
  `)

  const insertSnapshot = db.prepare(`
    INSERT INTO snapshots (repo_id, head_sha)
    VALUES (?, ?)
  `)

  for (const tracked of trackedRows) {
    const snapshot = getLatestSnapshot.get(tracked.repo_id) as { head_sha: string } | undefined
    const oldSha = snapshot?.head_sha
    if (oldSha === undefined) {
      if (sinceLast) {
        continue
      }

      const newSha = await deps.fetchHead({
        id: tracked.repo_id,
        full_name: tracked.full_name,
        url: tracked.url,
      })

      insertSnapshot.run(tracked.repo_id, newSha)
      continue
    }

    const newSha = await deps.fetchHead({
      id: tracked.repo_id,
      full_name: tracked.full_name,
      url: tracked.url,
    })

    if (newSha === oldSha) {
      continue
    }

    const trackedPaths = JSON.parse(tracked.tracked_paths_json) as string[]

    const sessionResult = await deps.createSession({
      repoFullName: tracked.full_name,
      repoUrl: tracked.url,
      fromSha: oldSha,
      toSha: newSha,
      targetKind: tracked.target_kind,
      trackedPaths,
    })

    const diffStatsJson = sessionResult.diffStats !== undefined
      ? JSON.stringify(sessionResult.diffStats)
      : null

    const changeId = insertChange.run(
      tracked.repo_id,
      oldSha,
      newSha,
      tracked.target_kind,
      diffStatsJson,
      sessionResult.driftFlag === true ? 1 : 0
    ).lastInsertRowid as number

    insertSession.run(changeId, sessionResult.sessionPath)
    insertSnapshot.run(tracked.repo_id, newSha)

    if (autoReview && deps.onSessionCreated !== undefined) {
      await deps.onSessionCreated(sessionResult.sessionPath)
    }
  }
}
