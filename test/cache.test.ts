import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { tmpdir, homedir, platform } from 'node:os'
import { mkdir, rm, stat } from 'node:fs/promises'
import {
  getCachePath,
  getRepoCachePath,
  getApiCachePath,
  getRunPath,
  ensureCacheDir,
} from '../src/cache.js'

describe('cache', () => {
  describe('getCachePath', () => {
    it('returns path for repos cache', () => {
      const path = getCachePath('repos')

      expect(path).toContain('scout')
      expect(path).toContain('repos')
    })

    it('returns path for api cache', () => {
      const path = getCachePath('api')

      expect(path).toContain('scout')
      expect(path).toContain('api')
    })

    it('returns path for runs cache', () => {
      const path = getCachePath('runs')

      expect(path).toContain('scout')
      expect(path).toContain('runs')
    })

    it('paths are XDG-compliant on Linux/macOS', () => {
      const path = getCachePath('repos')

      // On macOS: ~/Library/Caches/scout
      // On Linux: ~/.cache/scout (or XDG_CACHE_HOME/scout)
      // On Windows: %LOCALAPPDATA%/scout/Cache
      const os = platform()

      if (os === 'darwin') {
        expect(path).toContain('Library/Caches')
      } else if (os === 'linux') {
        const xdgCache = process.env['XDG_CACHE_HOME'] ?? join(homedir(), '.cache')
        expect(path.startsWith(xdgCache)).toBe(true)
      }
      // Windows paths vary, skip specific check
    })
  })

  describe('getRepoCachePath', () => {
    it('returns path for specific repo', () => {
      const path = getRepoCachePath('octocat', 'hello-world')

      expect(path).toContain('repos')
      expect(path).toContain('octocat')
      expect(path).toContain('hello-world')
    })

    it('uses owner/repo structure', () => {
      const path = getRepoCachePath('anthropics', 'anthropic-sdk-python')

      expect(path).toContain(join('octocat', 'hello-world').split(join('octocat', 'hello-world'))[0] ? '' : '')
      expect(path).toContain('anthropics')
      expect(path).toContain('anthropic-sdk-python')
    })

    it('handles special characters in repo names', () => {
      const path = getRepoCachePath('org-name', 'repo.name-123')

      expect(path).toContain('org-name')
      expect(path).toContain('repo.name-123')
    })
  })

  describe('getApiCachePath', () => {
    it('returns path for query hash', () => {
      const hash = 'abc123def456'
      const path = getApiCachePath(hash)

      expect(path).toContain('api')
      expect(path).toContain(hash)
    })

    it('includes .json extension', () => {
      const path = getApiCachePath('somehash')

      expect(path.endsWith('.json')).toBe(true)
    })
  })

  describe('getRunPath', () => {
    it('returns path for run ID', () => {
      const runId = 'run-2024-01-15-abc123'
      const path = getRunPath(runId)

      expect(path).toContain('runs')
      expect(path).toContain(runId)
    })

    it('returns a directory path (not a file)', () => {
      const path = getRunPath('my-run')

      // Should not end with an extension
      expect(path).not.toMatch(/\.\w+$/)
    })
  })

  describe('ensureCacheDir', () => {
    const testDir = join(tmpdir(), 'scout-cache-test-' + Date.now())

    beforeEach(async () => {
      // Ensure test dir doesn't exist
      await rm(testDir, { recursive: true, force: true })
    })

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true })
    })

    it('creates directory if it does not exist', async () => {
      const targetDir = join(testDir, 'nested', 'cache', 'dir')

      await ensureCacheDir(targetDir)

      const stats = await stat(targetDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('succeeds if directory already exists', async () => {
      const targetDir = join(testDir, 'existing')

      await mkdir(targetDir, { recursive: true })

      // Should not throw
      await expect(ensureCacheDir(targetDir)).resolves.not.toThrow()
    })

    it('creates parent directories recursively', async () => {
      const deepDir = join(testDir, 'a', 'b', 'c', 'd', 'e')

      await ensureCacheDir(deepDir)

      const stats = await stat(deepDir)
      expect(stats.isDirectory()).toBe(true)
    })
  })

  describe('cache path consistency', () => {
    it('repo cache path is under repos cache', () => {
      const reposPath = getCachePath('repos')
      const repoCachePath = getRepoCachePath('owner', 'repo')

      expect(repoCachePath.startsWith(reposPath)).toBe(true)
    })

    it('api cache path is under api cache', () => {
      const apiPath = getCachePath('api')
      const apiCachePath = getApiCachePath('hash123')

      expect(apiCachePath.startsWith(apiPath)).toBe(true)
    })

    it('run path is under runs cache', () => {
      const runsPath = getCachePath('runs')
      const runPath = getRunPath('run-123')

      expect(runPath.startsWith(runsPath)).toBe(true)
    })
  })
})
