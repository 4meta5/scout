import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import {
  loadConfig,
  getConfigPath,
  getDefaultConfig,
  ScoutConfigSchema,
  type ScoutConfig,
} from '../src/config.js'

describe('config', () => {
  describe('getDefaultConfig', () => {
    it('returns a valid config object', () => {
      const config = getDefaultConfig()

      // Verify structure exists
      expect(config).toHaveProperty('github')
      expect(config).toHaveProperty('discovery')
      expect(config).toHaveProperty('scoring')
      expect(config).toHaveProperty('focus')
      expect(config).toHaveProperty('caching')
      expect(config).toHaveProperty('rateLimit')
    })

    it('has correct default values for discovery', () => {
      const config = getDefaultConfig()

      expect(config.discovery.recencyWindowDays).toBe(90)
      expect(config.discovery.maxCandidatesTier1).toBe(50)
      expect(config.discovery.cloneBudget).toBe(5)
      expect(config.discovery.excludeKeywords).toEqual([])
      expect(config.discovery.allowLicenses).toContain('MIT')
      expect(config.discovery.allowLicenses).toContain('Apache-2.0')
    })

    it('has correct default values for scoring', () => {
      const config = getDefaultConfig()

      expect(config.scoring.wRecency).toBe(0.55)
      expect(config.scoring.wActivity).toBe(0.25)
      expect(config.scoring.wLanes).toBe(0.20)
      expect(config.scoring.wStructural).toBe(0.35)
      expect(config.scoring.wModernity).toBe(0.20)
    })

    it('has correct default values for focus', () => {
      const config = getDefaultConfig()

      expect(config.focus.entrypointsPerTarget).toBe(5)
      expect(config.focus.maxDirsPerTarget).toBe(8)
      expect(config.focus.maxFilesPerDir).toBe(25)
    })

    it('has correct default values for caching', () => {
      const config = getDefaultConfig()

      expect(config.caching.ttlHours).toBe(24)
      expect(config.caching.maxPagesPerLane).toBe(2)
    })

    it('has correct default values for rateLimit', () => {
      const config = getDefaultConfig()

      expect(config.rateLimit.searchRequestsPerMinute).toBe(20)
      expect(config.rateLimit.backoffBaseMs).toBe(750)
      expect(config.rateLimit.backoffMaxMs).toBe(15000)
    })

    it('validates against the Zod schema', () => {
      const config = getDefaultConfig()
      const result = ScoutConfigSchema.safeParse(config)

      expect(result.success).toBe(true)
    })
  })

  describe('getConfigPath', () => {
    it('returns global config path', () => {
      const path = getConfigPath('global')

      expect(path).toContain('config.json')
      expect(path).toContain('scout')
    })

    it('returns project config path for current directory', () => {
      const path = getConfigPath('project')

      expect(path).toContain('.scoutrc.json')
    })

    it('returns project config path for specified directory', () => {
      const projectRoot = '/some/project'
      const path = getConfigPath('project', projectRoot)

      expect(path).toBe(join(projectRoot, '.scoutrc.json'))
    })
  })

  describe('loadConfig', () => {
    const testDir = join(tmpdir(), 'scout-config-test-' + Date.now())
    const originalEnv = { ...process.env }

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true })
      // Clear relevant env vars
      delete process.env['GITHUB_TOKEN']
      delete process.env['SCOUT_DISCOVERY_RECENCY_WINDOW_DAYS']
      delete process.env['SCOUT_DISCOVERY_MAX_CANDIDATES_TIER1']
      delete process.env['SCOUT_DISCOVERY_CLONE_BUDGET']
      delete process.env['SCOUT_CACHING_TTL_HOURS']
    })

    afterEach(async () => {
      // Restore env vars
      process.env = { ...originalEnv }
      await rm(testDir, { recursive: true, force: true })
    })

    it('returns default config when no files exist', async () => {
      const config = await loadConfig(testDir)
      const defaultConfig = getDefaultConfig()

      expect(config.discovery.recencyWindowDays).toBe(defaultConfig.discovery.recencyWindowDays)
      expect(config.scoring.wRecency).toBe(defaultConfig.scoring.wRecency)
    })

    it('loads and merges project config', async () => {
      const projectConfig: Partial<ScoutConfig> = {
        discovery: {
          recencyWindowDays: 60,
          maxCandidatesTier1: 100,
          cloneBudget: 10,
          excludeKeywords: ['test'],
          allowLicenses: ['MIT'],
        },
      }

      await writeFile(
        join(testDir, '.scoutrc.json'),
        JSON.stringify(projectConfig)
      )

      const config = await loadConfig(testDir)

      expect(config.discovery.recencyWindowDays).toBe(60)
      expect(config.discovery.maxCandidatesTier1).toBe(100)
      expect(config.discovery.cloneBudget).toBe(10)
      // Other values should still be defaults
      expect(config.scoring.wRecency).toBe(0.55)
    })

    it('environment variables take precedence over file config', async () => {
      const projectConfig: Partial<ScoutConfig> = {
        github: {
          token: 'file-token',
        },
        discovery: {
          recencyWindowDays: 60,
          maxCandidatesTier1: 50,
          cloneBudget: 5,
          excludeKeywords: [],
          allowLicenses: ['MIT'],
        },
      }

      await writeFile(
        join(testDir, '.scoutrc.json'),
        JSON.stringify(projectConfig)
      )

      process.env['GITHUB_TOKEN'] = 'env-token'
      process.env['SCOUT_DISCOVERY_RECENCY_WINDOW_DAYS'] = '30'

      const config = await loadConfig(testDir)

      expect(config.github.token).toBe('env-token')
      expect(config.discovery.recencyWindowDays).toBe(30)
    })

    it('handles GITHUB_TOKEN from environment', async () => {
      process.env['GITHUB_TOKEN'] = 'my-secret-token'

      const config = await loadConfig(testDir)

      expect(config.github.token).toBe('my-secret-token')
    })

    it('handles numeric SCOUT_* env vars', async () => {
      process.env['SCOUT_DISCOVERY_CLONE_BUDGET'] = '15'
      process.env['SCOUT_CACHING_TTL_HOURS'] = '48'

      const config = await loadConfig(testDir)

      expect(config.discovery.cloneBudget).toBe(15)
      expect(config.caching.ttlHours).toBe(48)
    })

    it('ignores invalid JSON in config files', async () => {
      await writeFile(
        join(testDir, '.scoutrc.json'),
        'this is not valid JSON {'
      )

      // Should not throw, returns defaults
      const config = await loadConfig(testDir)
      const defaultConfig = getDefaultConfig()

      expect(config.discovery.recencyWindowDays).toBe(defaultConfig.discovery.recencyWindowDays)
    })

    it('partial config is merged with defaults', async () => {
      const partialConfig = {
        scoring: {
          wRecency: 0.70,
        },
      }

      await writeFile(
        join(testDir, '.scoutrc.json'),
        JSON.stringify(partialConfig)
      )

      const config = await loadConfig(testDir)

      // Overridden value
      expect(config.scoring.wRecency).toBe(0.70)
      // Default values still present
      expect(config.scoring.wActivity).toBe(0.25)
      expect(config.scoring.wLanes).toBe(0.20)
    })
  })
})
