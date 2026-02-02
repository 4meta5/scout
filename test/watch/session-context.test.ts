import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm, readFile } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-session-context-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testRoot, type),
}))

vi.mock('../../src/watch/diff.js', () => ({
  generateDiff: vi.fn().mockResolvedValue({
    patch: 'diff --git a/a b/a\n',
    filesChanged: 1,
    insertions: 1,
    deletions: 0,
    isEmpty: false,
  }),
  getExcludePatterns: vi.fn().mockResolvedValue([]),
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
    chunks: [{ index: 1, total: 1, content: 'diff', files: [], tokens: 10 }],
    totalTokens: 10,
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

describe('watch/session review context', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
  })

  afterEach(async () => {
    closeDb()
    await rm(testRoot, { recursive: true, force: true })
  })

  it('records pinned skill reference in review_context.json', async () => {
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
    await generateSession({
      repo: repoName,
      outputDir: sessionDir,
      skillCommit: 'deadbeef',
      skillName: 'trailofbits/differential-review',
    })

    const contextPath = join(sessionDir, 'review_context.json')
    const context = JSON.parse(await readFile(contextPath, 'utf-8'))

    expect(context.skillCommit).toBe('deadbeef')
    expect(context.skillName).toBe('trailofbits/differential-review')
  })
})
