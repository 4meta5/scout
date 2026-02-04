import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-session-exclude-' + Date.now())

vi.mock('@4meta5/scout', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@4meta5/scout')>()
  return {
    ...mod,
    getCachePath: (type: string) => join(testRoot, type),
  }
})

const generateDiff = vi.fn().mockResolvedValue({
  patch: '',
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
  isEmpty: true,
})
const getExcludePatterns = vi.fn().mockResolvedValue([':!generated/'])

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
    chunks: [{ index: 1, total: 1, content: '', files: [], tokens: 0 }],
    totalTokens: 0,
    wasChunked: false,
  }),
  getChunkFilename: vi.fn(),
  DEFAULT_MAX_TOKENS: 50000,
}))

const {
  insertTrackedRepo,
  updateTrackedRepoSha,
  closeDb,
} = await import('../../src/watch/db.js')
const { generateSession } = await import('../../src/watch/session.js')

describe('watch/session exclude patterns', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
    generateDiff.mockClear()
    getExcludePatterns.mockClear()
  })

  afterEach(async () => {
    closeDb()
    await rm(testRoot, { recursive: true, force: true })
  })

  it('passes merged exclude patterns to generateDiff', async () => {
    const repoName = 'owner/repo'
    const repoId = await insertTrackedRepo({
      repo: repoName,
      url: 'https://github.com/owner/repo',
      localPath: join(testRoot, 'repo'),
      baselineSha: 'old-sha',
      tier2Score: 0.5,
    })

    await updateTrackedRepoSha(repoId, 'new-sha')

    await expect(generateSession({ repo: repoName })).rejects.toThrow(/No changes in scope/)

    expect(generateDiff).toHaveBeenCalledTimes(1)
    const options = generateDiff.mock.calls[0]?.[0]
    expect(options?.excludePatterns).toContain(':!generated/')
  })
})
