import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm, mkdir, writeFile } from 'node:fs/promises'

// Mock the cache module to use a temp directory
const testDbDir = join(tmpdir(), 'scout-track-test-' + Date.now())
const testRepoDir = join(tmpdir(), 'scout-track-repo-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testDbDir, type),
}))

// Mock git operations
vi.mock('../../src/clone/hardened.js', () => ({
  getHeadSha: vi.fn().mockResolvedValue('abc1234567890'),
  normalizeGitUrl: (repo: string) => `https://github.com/${repo}.git`,
}))

// Import after mocking
const { closeDb } = await import('../../src/watch/db.js')
const {
  loadValidationSummary,
  trackRepo,
  trackFromValidationSummary,
  trackSingleRepo,
  listTrackedRepos,
} = await import('../../src/watch/track.js')

import type { ValidationSummary, ValidationResult } from '../../src/schemas/index.js'

describe('watch/track', () => {
  beforeEach(async () => {
    await rm(testDbDir, { recursive: true, force: true })
    await rm(testRepoDir, { recursive: true, force: true })
    await mkdir(testDbDir, { recursive: true })
    await mkdir(testRepoDir, { recursive: true })
  })

  afterEach(async () => {
    closeDb()
    await rm(testDbDir, { recursive: true, force: true })
    await rm(testRepoDir, { recursive: true, force: true })
  })

  const createValidationResult = (repo: string, tier2Score: number): ValidationResult => ({
    repo,
    localPath: join(testRepoDir, repo.replace('/', '_')),
    matchedTargets: [
      {
        kind: 'cli',
        evidence: ['has bin field'],
        focusRoots: ['src/cli'],
      },
    ],
    modernitySignals: [],
    structuralMatchCount: 1,
    modernityScore: 0.8,
    tier1Score: 0.7,
    tier2Score,
    entrypointCandidates: [
      {
        kind: 'cli',
        paths: ['src/cli/index.ts', 'src/cli/app.ts'],
      },
    ],
  })

  const createValidationSummary = (results: ValidationResult[]): ValidationSummary => ({
    timestamp: new Date().toISOString(),
    runId: 'test-run',
    totalValidated: results.length,
    reposWithMatches: results.filter(r => r.structuralMatchCount > 0).length,
    results,
  })

  describe('loadValidationSummary', () => {
    it('loads and parses a validation summary file', async () => {
      const summary = createValidationSummary([
        createValidationResult('owner/repo', 0.85),
      ])
      const filePath = join(testDbDir, 'summary.json')
      await writeFile(filePath, JSON.stringify(summary))

      const loaded = await loadValidationSummary(filePath)
      expect(loaded.results).toHaveLength(1)
      expect(loaded.results[0].repo).toBe('owner/repo')
    })
  })

  describe('trackRepo', () => {
    it('tracks a repo and returns added status', async () => {
      const result = createValidationResult('owner/repo', 0.85)
      const trackResult = await trackRepo(result)

      expect(trackResult.status).toBe('added')
      expect(trackResult.repo).toBe('owner/repo')
      expect(trackResult.id).toBeGreaterThan(0)
    })

    it('returns exists status for already tracked repo', async () => {
      const result = createValidationResult('owner/repo', 0.85)
      await trackRepo(result)

      const trackResult = await trackRepo(result)
      expect(trackResult.status).toBe('exists')
    })
  })

  describe('trackFromValidationSummary', () => {
    it('tracks repos with structural matches', async () => {
      const summary = createValidationSummary([
        createValidationResult('owner/repo1', 0.9),
        createValidationResult('owner/repo2', 0.7),
      ])

      const results = await trackFromValidationSummary(summary)

      expect(results).toHaveLength(2)
      expect(results.every(r => r.status === 'added')).toBe(true)
    })

    it('filters by repo name', async () => {
      const summary = createValidationSummary([
        createValidationResult('owner/repo1', 0.9),
        createValidationResult('owner/repo2', 0.7),
      ])

      const results = await trackFromValidationSummary(summary, {
        repoFilter: 'owner/repo1',
      })

      expect(results).toHaveLength(1)
      expect(results[0].repo).toBe('owner/repo1')
    })
  })

  describe('trackSingleRepo', () => {
    it('tracks a single repo by name', async () => {
      const summary = createValidationSummary([
        createValidationResult('owner/target', 0.85),
        createValidationResult('owner/other', 0.7),
      ])

      const result = await trackSingleRepo(summary, 'owner/target')

      expect(result.status).toBe('added')
      expect(result.repo).toBe('owner/target')
    })

    it('returns skipped for non-existent repo', async () => {
      const summary = createValidationSummary([])

      const result = await trackSingleRepo(summary, 'owner/missing')

      expect(result.status).toBe('skipped')
      expect(result.reason).toContain('Not found')
    })
  })

  describe('listTrackedRepos', () => {
    it('lists all tracked repos', async () => {
      const result1 = createValidationResult('owner/repo1', 0.9)
      const result2 = createValidationResult('owner/repo2', 0.7)
      await trackRepo(result1)
      await trackRepo(result2)

      const repos = await listTrackedRepos()

      expect(repos).toHaveLength(2)
      // Should be sorted by tier2 score descending
      expect(repos[0].repo).toBe('owner/repo1')
      expect(repos[1].repo).toBe('owner/repo2')
    })

    it('indicates no changes for fresh repos', async () => {
      const result = createValidationResult('owner/repo', 0.85)
      await trackRepo(result)

      const repos = await listTrackedRepos()
      expect(repos[0].hasChanges).toBe(false)
    })
  })
})
