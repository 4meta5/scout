import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-session-watch-drift-' + Date.now())

vi.mock('@4meta5/scout', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@4meta5/scout')>()
  return {
    ...mod,
    getCachePath: (type: string) => join(testRoot, type),
    getRepoCachePath: (owner: string, repo: string) => join(testRoot, 'repos', owner, repo),
    shallowClone: vi.fn().mockResolvedValue({ sha: 'new-sha', cached: false }),
    updateShallowClone: vi.fn().mockResolvedValue('new-sha'),
    normalizeGitUrl: (input: string) => input,
  }
})

vi.mock('../../src/watch/fetch.js', () => ({
  createWorktree: vi.fn().mockResolvedValue(undefined),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/watch/diff.js', () => ({
  generateDiff: vi.fn().mockResolvedValue({
    patch: 'diff --git a/a b/a\n',
    filesChanged: 1,
    insertions: 2,
    deletions: 1,
    isEmpty: false,
  }),
  getExcludePatterns: vi.fn().mockResolvedValue([]),
}))

const detectDrift = vi.fn().mockResolvedValue({ entries: [], hasDrift: false, summary: '' })

vi.mock('../../src/watch/drift.js', () => ({
  detectDrift,
}))

vi.mock('../../src/watch/chunk.js', () => ({
  chunkDiff: vi.fn().mockReturnValue({
    chunks: [{ index: 1, total: 1, content: 'diff --git a/a b/a\n', files: ['a'], tokens: 10 }],
    totalTokens: 10,
    wasChunked: false,
  }),
  getChunkFilename: vi.fn(),
  DEFAULT_MAX_TOKENS: 50000,
}))

const { createWatchSession } = await import('../../src/watch/session-watch.js')

describe('watch/session-watch drift paths', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
    detectDrift.mockClear()
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('passes real tracked path records to detectDrift', async () => {
    await createWatchSession({
      repoFullName: 'owner/repo',
      repoUrl: 'https://github.com/owner/repo.git',
      oldSha: 'old-sha',
      newSha: 'new-sha',
      targetKind: 'cli',
      trackedPaths: ['src/cli', 'src/bin'],
    })

    const call = detectDrift.mock.calls[0]
    const tracked = call?.[3] as Array<{ path: string; kind: string; id?: number; repoId?: number }>

    expect(tracked.every(p => p.id === undefined && p.repoId === undefined)).toBe(true)
    expect(tracked.map(p => p.path)).toEqual(['src/cli', 'src/bin'])
  })
})
