import { describe, it, expect } from 'vitest'
import {
  computeTier1Score,
  isLicenseAllowed,
  shouldExclude,
  isTooOld,
} from '../src/discovery/scoring.js'
import { computeTier2Score } from '../src/validation/scoring.js'
import { getDefaultConfig } from '../src/config.js'

describe('scoring', () => {
  const config = getDefaultConfig()

  describe('computeTier1Score', () => {
    it('returns high score for recent active repo with multiple lane hits', () => {
      const score = computeTier1Score({
        pushedAt: new Date().toISOString(),
        stars: 1000,
        forks: 100,
        laneHitsCount: 3,
      }, config)

      expect(score).toBeGreaterThan(0.7)
    })

    it('returns lower score for older repo', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 60)

      const score = computeTier1Score({
        pushedAt: oldDate.toISOString(),
        stars: 100,
        forks: 10,
        laneHitsCount: 1,
      }, config)

      expect(score).toBeLessThan(0.6)
    })

    it('returns score between 0 and 1', () => {
      const score = computeTier1Score({
        pushedAt: new Date().toISOString(),
        stars: 50000,
        forks: 5000,
        laneHitsCount: 10,
      }, config)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('is deterministic for same inputs', () => {
      const input = {
        pushedAt: '2024-01-15T00:00:00Z',
        stars: 500,
        forks: 50,
        laneHitsCount: 2,
      }

      const score1 = computeTier1Score(input, config)
      const score2 = computeTier1Score(input, config)

      expect(score1).toBe(score2)
    })
  })

  describe('computeTier2Score', () => {
    it('adds structural and modernity components to tier1', () => {
      const tier1 = 0.5
      const tier2 = computeTier2Score(tier1, 2, 0.8, config)

      expect(tier2).toBeGreaterThan(tier1)
    })

    it('clamps to 0-1 range', () => {
      const tier2 = computeTier2Score(0.9, 3, 1.0, config)

      expect(tier2).toBeLessThanOrEqual(1)
    })
  })

  describe('isLicenseAllowed', () => {
    const allowList = config.discovery.allowLicenses

    it('allows MIT license', () => {
      expect(isLicenseAllowed('MIT', allowList)).toBe(true)
    })

    it('allows Apache-2.0 license', () => {
      expect(isLicenseAllowed('Apache-2.0', allowList)).toBe(true)
    })

    it('allows null (unknown) license', () => {
      expect(isLicenseAllowed(null, allowList)).toBe(true)
    })

    it('rejects GPL license by default', () => {
      expect(isLicenseAllowed('GPL-3.0', allowList)).toBe(false)
    })
  })

  describe('shouldExclude', () => {
    it('excludes based on name match', () => {
      expect(shouldExclude('awesome-list', 'A list of things', ['awesome'])).toBe(true)
    })

    it('excludes based on description match', () => {
      expect(shouldExclude('my-repo', 'An awesome collection', ['awesome'])).toBe(true)
    })

    it('returns false when no matches', () => {
      expect(shouldExclude('my-repo', 'A normal repo', ['awesome', 'list'])).toBe(false)
    })

    it('handles null description', () => {
      expect(shouldExclude('normal-repo', null, ['test'])).toBe(false)
    })
  })

  describe('isTooOld', () => {
    it('returns true for old repos', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 100)

      expect(isTooOld(oldDate.toISOString(), 90)).toBe(true)
    })

    it('returns false for recent repos', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 30)

      expect(isTooOld(recentDate.toISOString(), 90)).toBe(false)
    })
  })
})
