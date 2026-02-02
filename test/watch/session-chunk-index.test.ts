import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm, readFile } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-session-chunk-index-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testRoot, type),
}))

const generateDiff = vi.fn().mockResolvedValue({
  patch: 'diff --git a/a b/a\n',
  filesChanged: 2,
  insertions: 2,
  deletions: 0,
  isEmpty: false,
})
const getExcludePatterns = vi.fn().mockResolvedValue([])

vi.mock('../../src/watch/diff.js', () => ({
  generateDiff,
  getExcludePatterns,
}))

vi.mock('../../src/watch/fetch.js', () => ({
  createWorktree: vi.fn().mockResolvedValue(undefined),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/watch/drift.js', () => ({
  detectDrift: vi.fn().mockResolvedValue({ entries: [], hasDrift: false, summary: '' }),
}))

vi.mock('../../src/watch/chunk.js', () => ({
  chunkDiff: vi.fn().mockReturnValue({
    chunks: [
      { index: 1, total: 2, content: 'chunk1', files: ['src/a.ts'], tokens: 10 },
      { index: 2, total: 2, content: 'chunk2', files: ['src/b.ts'], tokens: 12 },
    ],
    totalTokens: 22,
    wasChunked: true,
  }),
  getChunkFilename: (index: number) => `diff.${String(index).padStart(3, '0')}.patch`,
  DEFAULT_MAX_TOKENS: 50000,
}))

const {
  insertTrackedRepo,
  updateTrackedRepoSha,
  closeDb,
} = await import('../../src/watch/db.js')
const { generateSession } = await import('../../src/watch/session.js')

describe('watch/session chunk index', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
  })

  afterEach(async () => {
    closeDb()
    await rm(testRoot, { recursive: true, force: true })
  })

  it('writes CHUNK_INDEX.md when diff is chunked', async () => {
    const repoName = 'owner/repo'
    const repoId = await insertTrackedRepo({
      repo: repoName,
      url: 'https://github.com/owner/repo',
      localPath: join(testRoot, 'repo'),
      baselineSha: 'old-sha',
      tier2Score: 0.5,
    })

    await updateTrackedRepoSha(repoId, 'new-sha')

    const sessionDir = join(testRoot, 'session')
    await generateSession({ repo: repoName, outputDir: sessionDir })

    const indexPath = join(sessionDir, 'CHUNK_INDEX.md')
    const contents = await readFile(indexPath, 'utf-8')
    expect(contents).toContain('diff.001.patch')
    expect(contents).toContain('diff.002.patch')
    expect(contents).toContain('src/a.ts')
    expect(contents).toContain('src/b.ts')
  })
})
