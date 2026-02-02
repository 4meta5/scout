import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm, mkdir } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-watch-run-once-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testRoot, type),
}))

const { getDb, closeDb } = await import('../../src/watch/db.js')
const { runWatchOnce } = await import('../../src/watch/run-once.js')

describe('watch/run-once', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
  })

  afterEach(async () => {
    closeDb()
    await rm(testRoot, { recursive: true, force: true })
  })

  it('creates change + session and updates snapshot when head changes', async () => {
    const db = await getDb()

    const repoId = db.prepare(
      'INSERT INTO repos (full_name, url, default_branch, license_spdx) VALUES (?, ?, ?, ?)'
    ).run('owner/repo', 'https://github.com/owner/repo', 'main', 'MIT').lastInsertRowid as number

    db.prepare(
      'INSERT INTO tracked (repo_id, target_kind, tracked_paths_json, enabled, interval_hours) VALUES (?, ?, ?, 1, 24)'
    ).run(repoId, 'cli', JSON.stringify(['src/cli']))

    db.prepare(
      'INSERT INTO snapshots (repo_id, head_sha) VALUES (?, ?)'
    ).run(repoId, 'old-sha')

    const fetchHead = vi.fn().mockResolvedValue('new-sha')
    const createSession = vi.fn().mockResolvedValue({
      sessionPath: join(testRoot, 'session'),
      driftFlag: false,
    })

    await runWatchOnce({
      fetchHead,
      createSession,
    })

    const snapshot = db.prepare('SELECT head_sha FROM snapshots WHERE repo_id = ? ORDER BY id DESC LIMIT 1').get(repoId) as { head_sha: string }
    expect(snapshot.head_sha).toBe('new-sha')

    const change = db.prepare('SELECT from_sha, to_sha, target_kind FROM changes WHERE repo_id = ?').get(repoId) as { from_sha: string; to_sha: string; target_kind: string }
    expect(change.from_sha).toBe('old-sha')
    expect(change.to_sha).toBe('new-sha')
    expect(change.target_kind).toBe('cli')

    const session = db.prepare('SELECT session_path FROM sessions').get() as { session_path: string }
    expect(session.session_path).toBe(join(testRoot, 'session'))
  })

  it('initializes snapshot when none exists and sinceLast is false', async () => {
    const db = await getDb()

    const repoId = db.prepare(
      'INSERT INTO repos (full_name, url, default_branch, license_spdx) VALUES (?, ?, ?, ?)'
    ).run('owner/repo', 'https://github.com/owner/repo', 'main', 'MIT').lastInsertRowid as number

    db.prepare(
      'INSERT INTO tracked (repo_id, target_kind, tracked_paths_json, enabled, interval_hours) VALUES (?, ?, ?, 1, 24)'
    ).run(repoId, 'cli', JSON.stringify(['src/cli']))

    const fetchHead = vi.fn().mockResolvedValue('new-sha')
    const createSession = vi.fn().mockResolvedValue({
      sessionPath: join(testRoot, 'session'),
      driftFlag: false,
    })

    await runWatchOnce({
      fetchHead,
      createSession,
      sinceLast: false,
    })

    expect(fetchHead).toHaveBeenCalledTimes(1)
    const change = db.prepare('SELECT count(*) as count FROM changes').get() as { count: number }
    expect(change.count).toBe(0)
    expect(createSession).not.toHaveBeenCalled()

    const snapshot = db.prepare('SELECT head_sha FROM snapshots WHERE repo_id = ? ORDER BY id DESC LIMIT 1').get(repoId) as { head_sha: string }
    expect(snapshot.head_sha).toBe('new-sha')
  })

  it('uses latest snapshot as fromSha when multiple snapshots exist', async () => {
    const db = await getDb()

    const repoId = db.prepare(
      'INSERT INTO repos (full_name, url, default_branch, license_spdx) VALUES (?, ?, ?, ?)'
    ).run('owner/repo', 'https://github.com/owner/repo', 'main', 'MIT').lastInsertRowid as number

    db.prepare(
      'INSERT INTO tracked (repo_id, target_kind, tracked_paths_json, enabled, interval_hours) VALUES (?, ?, ?, 1, 24)'
    ).run(repoId, 'cli', JSON.stringify(['src/cli']))

    db.prepare('INSERT INTO snapshots (repo_id, head_sha) VALUES (?, ?)').run(repoId, 'old-sha')
    db.prepare('INSERT INTO snapshots (repo_id, head_sha) VALUES (?, ?)').run(repoId, 'mid-sha')

    const fetchHead = vi.fn().mockResolvedValue('new-sha')
    const createSession = vi.fn().mockResolvedValue({
      sessionPath: join(testRoot, 'session'),
      driftFlag: false,
    })

    await runWatchOnce({
      fetchHead,
      createSession,
      sinceLast: true,
    })

    const change = db.prepare('SELECT from_sha, to_sha FROM changes WHERE repo_id = ?').get(repoId) as { from_sha: string; to_sha: string }
    expect(change.from_sha).toBe('mid-sha')
    expect(change.to_sha).toBe('new-sha')
  })

  it('persists diff stats json for each change', async () => {
    const db = await getDb()

    const repoId = db.prepare(
      'INSERT INTO repos (full_name, url, default_branch, license_spdx) VALUES (?, ?, ?, ?)'
    ).run('owner/repo', 'https://github.com/owner/repo', 'main', 'MIT').lastInsertRowid as number

    db.prepare(
      'INSERT INTO tracked (repo_id, target_kind, tracked_paths_json, enabled, interval_hours) VALUES (?, ?, ?, 1, 24)'
    ).run(repoId, 'cli', JSON.stringify(['src/cli']))

    db.prepare('INSERT INTO snapshots (repo_id, head_sha) VALUES (?, ?)').run(repoId, 'old-sha')

    const fetchHead = vi.fn().mockResolvedValue('new-sha')
    const createSession = vi.fn().mockResolvedValue({
      sessionPath: join(testRoot, 'session'),
      driftFlag: false,
      diffStats: { filesChanged: 2, insertions: 5, deletions: 1 },
    })

    await runWatchOnce({
      fetchHead,
      createSession,
      sinceLast: true,
    })

    const change = db.prepare('SELECT diff_stats_json FROM changes WHERE repo_id = ?').get(repoId) as { diff_stats_json: string }
    expect(change.diff_stats_json).toBe(JSON.stringify({ filesChanged: 2, insertions: 5, deletions: 1 }))
  })
})
