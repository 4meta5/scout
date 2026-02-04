import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm, mkdir } from 'node:fs/promises'

// Mock the cache module to use a temp directory
const testDbDir = join(tmpdir(), 'scout-watch-test-' + Date.now())

vi.mock('@4meta5/scout', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@4meta5/scout')>()
  return {
    ...mod,
    getCachePath: (type: string) => join(testDbDir, type),
  }
})

// Import after mocking
const {
  getDb,
  closeDb,
  insertTrackedRepo,
  getTrackedRepoByName,
  getTrackedRepoById,
  getAllTrackedRepos,
  updateTrackedRepoSha,
  getTrackedReposWithChanges,
  deleteTrackedRepo,
  insertTrackedPath,
  insertTrackedPaths,
  getTrackedPathsByRepoId,
  deleteTrackedPathsByRepoId,
  insertReviewSession,
  getReviewSessionById,
  getReviewSessionByPath,
  getPendingReviewSessions,
  markReviewSessionRunning,
  markReviewSessionComplete,
} = await import('../../src/watch/db.js')

describe('watch/db', () => {
  beforeEach(async () => {
    await rm(testDbDir, { recursive: true, force: true })
    await mkdir(testDbDir, { recursive: true })
  })

  afterEach(async () => {
    closeDb()
    await rm(testDbDir, { recursive: true, force: true })
  })

  describe('database initialization', () => {
    it('creates database and tables', async () => {
      const db = await getDb()
      expect(db).toBeDefined()

      // Verify tables exist by querying them
      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
      `).all() as Array<{ name: string }>

      const tableNames = tables.map(t => t.name)
      expect(tableNames).toContain('tracked_repos')
      expect(tableNames).toContain('tracked_paths')
      expect(tableNames).toContain('review_sessions')
    })

    it('enables WAL mode', async () => {
      const db = await getDb()
      const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>
      expect(result[0].journal_mode).toBe('wal')
    })
  })

  describe('tracked repos CRUD', () => {
    it('inserts and retrieves a tracked repo', async () => {
      const input = {
        repo: 'owner/repo',
        url: 'https://github.com/owner/repo',
        localPath: '/path/to/repo',
        baselineSha: 'abc123',
        tier2Score: 0.85,
      }

      const id = await insertTrackedRepo(input)
      expect(id).toBeGreaterThan(0)

      const repo = await getTrackedRepoByName('owner/repo')
      expect(repo).not.toBeNull()
      expect(repo?.repo).toBe('owner/repo')
      expect(repo?.url).toBe('https://github.com/owner/repo')
      expect(repo?.localPath).toBe('/path/to/repo')
      expect(repo?.baselineSha).toBe('abc123')
      expect(repo?.lastSha).toBeNull()
      expect(repo?.tier2Score).toBe(0.85)
    })

    it('retrieves repo by ID', async () => {
      const id = await insertTrackedRepo({
        repo: 'test/repo',
        url: 'https://github.com/test/repo',
        localPath: '/test',
        baselineSha: 'sha1',
        tier2Score: 0.5,
      })

      const repo = await getTrackedRepoById(id)
      expect(repo).not.toBeNull()
      expect(repo?.id).toBe(id)
    })

    it('returns null for non-existent repo', async () => {
      const repo = await getTrackedRepoByName('nonexistent/repo')
      expect(repo).toBeNull()
    })

    it('gets all tracked repos sorted by tier2 score', async () => {
      await insertTrackedRepo({
        repo: 'low/score',
        url: 'https://github.com/low/score',
        localPath: '/low',
        baselineSha: 'sha1',
        tier2Score: 0.3,
      })
      await insertTrackedRepo({
        repo: 'high/score',
        url: 'https://github.com/high/score',
        localPath: '/high',
        baselineSha: 'sha2',
        tier2Score: 0.9,
      })

      const repos = await getAllTrackedRepos()
      expect(repos).toHaveLength(2)
      expect(repos[0].repo).toBe('high/score')
      expect(repos[1].repo).toBe('low/score')
    })

    it('updates last_sha', async () => {
      const id = await insertTrackedRepo({
        repo: 'test/update',
        url: 'https://github.com/test/update',
        localPath: '/test',
        baselineSha: 'old-sha',
        tier2Score: 0.5,
      })

      await updateTrackedRepoSha(id, 'new-sha')

      const repo = await getTrackedRepoById(id)
      expect(repo?.lastSha).toBe('new-sha')
    })

    it('finds repos with changes', async () => {
      const id1 = await insertTrackedRepo({
        repo: 'no/change',
        url: 'https://github.com/no/change',
        localPath: '/no',
        baselineSha: 'same-sha',
        tier2Score: 0.5,
      })
      await updateTrackedRepoSha(id1, 'same-sha')

      const id2 = await insertTrackedRepo({
        repo: 'has/change',
        url: 'https://github.com/has/change',
        localPath: '/has',
        baselineSha: 'old-sha',
        tier2Score: 0.7,
      })
      await updateTrackedRepoSha(id2, 'new-sha')

      const changed = await getTrackedReposWithChanges()
      expect(changed).toHaveLength(1)
      expect(changed[0].repo).toBe('has/change')
    })

    it('deletes a tracked repo', async () => {
      const id = await insertTrackedRepo({
        repo: 'to/delete',
        url: 'https://github.com/to/delete',
        localPath: '/delete',
        baselineSha: 'sha',
        tier2Score: 0.5,
      })

      await deleteTrackedRepo(id)

      const repo = await getTrackedRepoById(id)
      expect(repo).toBeNull()
    })
  })

  describe('tracked paths CRUD', () => {
    it('inserts and retrieves tracked paths', async () => {
      const repoId = await insertTrackedRepo({
        repo: 'test/paths',
        url: 'https://github.com/test/paths',
        localPath: '/test',
        baselineSha: 'sha',
        tier2Score: 0.5,
      })

      await insertTrackedPath({ repoId, kind: 'cli', path: 'src/cli' })
      await insertTrackedPath({ repoId, kind: 'library', path: 'src/lib' })

      const paths = await getTrackedPathsByRepoId(repoId)
      expect(paths).toHaveLength(2)
      expect(paths.map(p => p.path)).toContain('src/cli')
      expect(paths.map(p => p.path)).toContain('src/lib')
    })

    it('inserts multiple paths in transaction', async () => {
      const repoId = await insertTrackedRepo({
        repo: 'test/bulk',
        url: 'https://github.com/test/bulk',
        localPath: '/test',
        baselineSha: 'sha',
        tier2Score: 0.5,
      })

      await insertTrackedPaths([
        { repoId, kind: 'mcp-server', path: 'src/mcp' },
        { repoId, kind: 'skill', path: 'src/skills' },
        { repoId, kind: 'hook', path: 'src/hooks' },
      ])

      const paths = await getTrackedPathsByRepoId(repoId)
      expect(paths).toHaveLength(3)
    })

    it('ignores duplicate paths', async () => {
      const repoId = await insertTrackedRepo({
        repo: 'test/dup',
        url: 'https://github.com/test/dup',
        localPath: '/test',
        baselineSha: 'sha',
        tier2Score: 0.5,
      })

      await insertTrackedPath({ repoId, kind: 'cli', path: 'src/cli' })
      await insertTrackedPath({ repoId, kind: 'cli', path: 'src/cli' }) // duplicate

      const paths = await getTrackedPathsByRepoId(repoId)
      expect(paths).toHaveLength(1)
    })

    it('cascades delete on repo deletion', async () => {
      const repoId = await insertTrackedRepo({
        repo: 'test/cascade',
        url: 'https://github.com/test/cascade',
        localPath: '/test',
        baselineSha: 'sha',
        tier2Score: 0.5,
      })

      await insertTrackedPath({ repoId, kind: 'cli', path: 'src/cli' })

      await deleteTrackedRepo(repoId)

      const paths = await getTrackedPathsByRepoId(repoId)
      expect(paths).toHaveLength(0)
    })
  })

  describe('review sessions CRUD', () => {
    let repoId: number

    beforeEach(async () => {
      repoId = await insertTrackedRepo({
        repo: 'test/review',
        url: 'https://github.com/test/review',
        localPath: '/test',
        baselineSha: 'sha',
        tier2Score: 0.5,
      })
    })

    it('inserts and retrieves a review session', async () => {
      const id = await insertReviewSession({
        repoId,
        sessionPath: '/reviews/test_review/2024-01-15',
        oldSha: 'old-sha',
        newSha: 'new-sha',
        targetKind: 'cli',
        chunkCount: 3,
      })

      const session = await getReviewSessionById(id)
      expect(session).not.toBeNull()
      expect(session?.repoId).toBe(repoId)
      expect(session?.sessionPath).toBe('/reviews/test_review/2024-01-15')
      expect(session?.oldSha).toBe('old-sha')
      expect(session?.newSha).toBe('new-sha')
      expect(session?.targetKind).toBe('cli')
      expect(session?.status).toBe('pending')
      expect(session?.chunkCount).toBe(3)
    })

    it('retrieves session by path', async () => {
      await insertReviewSession({
        repoId,
        sessionPath: '/unique/path',
        oldSha: 'old',
        newSha: 'new',
        targetKind: null,
        chunkCount: 1,
      })

      const session = await getReviewSessionByPath('/unique/path')
      expect(session).not.toBeNull()
      expect(session?.sessionPath).toBe('/unique/path')
    })

    it('gets pending review sessions', async () => {
      await insertReviewSession({
        repoId,
        sessionPath: '/pending',
        oldSha: 'old',
        newSha: 'new',
        targetKind: null,
        chunkCount: 1,
      })

      const pending = await getPendingReviewSessions()
      expect(pending).toHaveLength(1)
      expect(pending[0].status).toBe('pending')
    })

    it('marks session as running', async () => {
      const id = await insertReviewSession({
        repoId,
        sessionPath: '/running',
        oldSha: 'old',
        newSha: 'new',
        targetKind: null,
        chunkCount: 1,
      })

      await markReviewSessionRunning(id)

      const session = await getReviewSessionById(id)
      expect(session?.status).toBe('running')
      expect(session?.startedAt).not.toBeNull()
    })

    it('marks session as complete', async () => {
      const id = await insertReviewSession({
        repoId,
        sessionPath: '/complete',
        oldSha: 'old',
        newSha: 'new',
        targetKind: null,
        chunkCount: 1,
      })

      await markReviewSessionComplete(id, 'success', 0)

      const session = await getReviewSessionById(id)
      expect(session?.status).toBe('success')
      expect(session?.finishedAt).not.toBeNull()
      expect(session?.exitCode).toBe(0)
    })

    it('cascades delete on repo deletion', async () => {
      const sessionId = await insertReviewSession({
        repoId,
        sessionPath: '/cascade',
        oldSha: 'old',
        newSha: 'new',
        targetKind: null,
        chunkCount: 1,
      })

      await deleteTrackedRepo(repoId)

      const session = await getReviewSessionById(sessionId)
      expect(session).toBeNull()
    })
  })
})
