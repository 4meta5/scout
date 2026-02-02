import { describe, it, expect, vi } from 'vitest'

const insertRepoV2 = vi.fn().mockResolvedValue(1)
const upsertTrackedV2 = vi.fn().mockResolvedValue(2)
const listTrackedV2 = vi.fn().mockResolvedValue([])
const removeTrackedV2 = vi.fn().mockResolvedValue(true)

vi.mock('../../src/watch/db.js', () => ({
  insertRepoV2,
  upsertTrackedV2,
  listTrackedV2,
  removeTrackedV2,
  closeDb: vi.fn(),
}))

vi.mock('../../src/clone/hardened.js', () => ({
  normalizeGitUrl: (input: string) => `https://github.com/${input}.git`,
}))

const { runWatchAdd, runWatchList, runWatchRemove } = await import('../../src/commands/watch-track.js')

describe('commands/watch-track', () => {
  it('adds a tracked repo with paths', async () => {
    await runWatchAdd({
      repo: 'owner/repo',
      targetKind: 'cli',
      paths: ['src/cli', 'src/bin'],
    })

    expect(insertRepoV2).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'owner/repo',
      url: 'https://github.com/owner/repo.git',
    }))
    expect(upsertTrackedV2).toHaveBeenCalledWith(expect.objectContaining({
      repoId: 1,
      targetKind: 'cli',
      trackedPaths: ['src/cli', 'src/bin'],
    }))
  })

  it('lists tracked repos', async () => {
    await runWatchList()
    expect(listTrackedV2).toHaveBeenCalled()
  })

  it('removes tracked entry', async () => {
    await runWatchRemove({ repo: 'owner/repo', targetKind: 'cli' })
    expect(removeTrackedV2).toHaveBeenCalledWith('owner/repo', 'cli')
  })

  it('accepts kebab-case flags in command handler', async () => {
    await runWatchAdd({
      repo: 'owner/repo',
      'target-kind': 'cli',
      'interval-hours': 12,
      paths: ['src/cli'],
    })

    expect(upsertTrackedV2).toHaveBeenCalledWith(expect.objectContaining({
      targetKind: 'cli',
      intervalHours: 12,
    }))
  })
})
