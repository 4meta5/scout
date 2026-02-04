import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm, readFile } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-session-drift-' + Date.now())

vi.mock('@4meta5/scout', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@4meta5/scout')>()
  return {
    ...mod,
    getCachePath: (type: string) => join(testRoot, type),
  }
})

const generateDiff = vi.fn()
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
  chunkDiff: vi.fn().mockImplementation((patch: string) => ({
    chunks: [{ index: 1, total: 1, content: patch, files: [], tokens: 1 }],
    totalTokens: 1,
    wasChunked: false,
  })),
  getChunkFilename: vi.fn(),
  DEFAULT_MAX_TOKENS: 50000,
}))

const {
  insertTrackedRepo,
  insertTrackedPath,
  updateTrackedRepoSha,
  closeDb,
} = await import('../../src/watch/db.js')
const { generateSession } = await import('../../src/watch/session.js')

describe('watch/session drift rule', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
    generateDiff.mockReset()
    generateDiff
      .mockResolvedValueOnce({
        patch: '',
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
        isEmpty: true,
      })
      .mockResolvedValueOnce({
        patch: 'diff --git a/file b/file\n',
        filesChanged: 1,
        insertions: 1,
        deletions: 0,
        isEmpty: false,
      })
  })

  afterEach(async () => {
    closeDb()
    await rm(testRoot, { recursive: true, force: true })
  })

  it('writes DRIFT.md when scoped diff is empty but overall diff has changes', async () => {
    const repoName = 'owner/repo'
    const repoId = await insertTrackedRepo({
      repo: repoName,
      url: 'https://github.com/owner/repo',
      localPath: join(testRoot, 'repo'),
      baselineSha: 'old-sha',
      tier2Score: 0.5,
    })

    await insertTrackedPath({ repoId, kind: 'cli', path: 'src/cli' })
    await updateTrackedRepoSha(repoId, 'new-sha')

    const sessionDir = join(testRoot, 'session')
    const result = await generateSession({ repo: repoName, outputDir: sessionDir })

    expect(result.hasDrift).toBe(true)
    const driftPath = join(sessionDir, 'DRIFT.md')
    const driftContents = await readFile(driftPath, 'utf-8')
    expect(driftContents).toMatch(/drift/i)
  })
})
