import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm, mkdir } from 'node:fs/promises'

const testDbDir = join(tmpdir(), 'scout-watch-v2-helpers-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testDbDir, type),
}))

const {
  getDb,
  closeDb,
  insertRepoV2,
  upsertTrackedV2,
  listTrackedV2,
  removeTrackedV2,
} = await import('../../src/watch/db.js')

describe('watch/db v2 helpers', () => {
  beforeEach(async () => {
    await rm(testDbDir, { recursive: true, force: true })
    await mkdir(testDbDir, { recursive: true })
  })

  afterEach(async () => {
    closeDb()
    await rm(testDbDir, { recursive: true, force: true })
  })

  it('adds, lists, and removes tracked entries', async () => {
    await getDb()

    const repoId = await insertRepoV2({
      fullName: 'owner/repo',
      url: 'https://github.com/owner/repo.git',
      defaultBranch: 'main',
      licenseSpdx: 'MIT',
    })

    await upsertTrackedV2({
      repoId,
      targetKind: 'cli',
      trackedPaths: ['src/cli'],
      enabled: true,
      intervalHours: 24,
    })

    const list = await listTrackedV2()
    expect(list).toHaveLength(1)
    expect(list[0]?.repoFullName).toBe('owner/repo')
    expect(list[0]?.targetKind).toBe('cli')

    const removed = await removeTrackedV2('owner/repo', 'cli')
    expect(removed).toBe(true)

    const after = await listTrackedV2()
    expect(after).toHaveLength(0)
  })
})
