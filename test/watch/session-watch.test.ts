import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm, readFile } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-session-watch-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testRoot, type),
  getRepoCachePath: (owner: string, repo: string) => join(testRoot, 'repos', owner, repo),
}))

vi.mock('../../src/clone/hardened.js', () => ({
  shallowClone: vi.fn().mockResolvedValue({ sha: 'new-sha', cached: false }),
  updateShallowClone: vi.fn().mockResolvedValue('new-sha'),
  normalizeGitUrl: (input: string) => input,
}))

vi.mock('../../src/watch/fetch.js', () => ({
  createWorktree: vi.fn().mockResolvedValue(undefined),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
}))

const generateDiff = vi.fn().mockResolvedValue({
  patch: 'diff --git a/a b/a\n',
  filesChanged: 1,
  insertions: 2,
  deletions: 1,
  isEmpty: false,
})

const getExcludePatterns = vi.fn().mockResolvedValue([])

vi.mock('../../src/watch/diff.js', () => ({
  generateDiff,
  getExcludePatterns,
}))

vi.mock('../../src/watch/drift.js', () => ({
  detectDrift: vi.fn().mockResolvedValue({ entries: [], hasDrift: false, summary: '' }),
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

describe('watch/session-watch', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
    generateDiff.mockClear()
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('writes diff.patch and returns diff stats', async () => {
    const result = await createWatchSession({
      repoFullName: 'owner/repo',
      repoUrl: 'https://github.com/owner/repo.git',
      oldSha: 'old-sha',
      newSha: 'new-sha',
      targetKind: 'cli',
      trackedPaths: ['src/cli'],
    })

    const patch = await readFile(join(result.sessionPath, 'diff.patch'), 'utf-8')
    expect(patch).toContain('diff --git')
    expect(result.diffStats).toEqual({ filesChanged: 1, insertions: 2, deletions: 1 })
  })

  it('passes config-driven excludes and chunking limits', async () => {
    await createWatchSession({
      repoFullName: 'owner/repo',
      repoUrl: 'https://github.com/owner/repo.git',
      oldSha: 'old-sha',
      newSha: 'new-sha',
      targetKind: 'cli',
      trackedPaths: ['src/cli'],
      excludePatterns: [':!secrets.env'],
      maxTokens: 1234,
      maxFilesPerChunk: 2,
    })

    expect(getExcludePatterns).toHaveBeenCalledWith(expect.any(String), [':!secrets.env'])
  })
})
