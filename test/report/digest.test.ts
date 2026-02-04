/**
 * Test for compact digest report format.
 */

import { describe, it, expect } from 'vitest'
import { formatDigestMd } from '../../src/report/digest.js'
import type { CompareReport } from '../../src/schemas/report.js'

describe('formatDigestMd', () => {
  const mockReport: CompareReport = {
    runId: 'abc12345',
    timestamp: '2026-02-03T12:00:00Z',
    sourceProject: {
      root: '/path/to/project',
      commit: 'abc1234',
      targetKinds: ['cli'],
    },
    candidates: [
      {
        repo: 'owner/repo1',
        tier1Score: 0.85,
        tier2Score: 0.9,
        matchedKinds: ['cli'],
        modernityScore: 0.95,
        license: 'MIT',
        topEntrypoints: ['src/cli.ts', 'src/index.ts'],
      },
      {
        repo: 'owner/repo2',
        tier1Score: 0.7,
        tier2Score: 0.75,
        matchedKinds: ['cli'],
        modernityScore: 0.8,
        license: 'Apache-2.0',
        topEntrypoints: ['src/main.ts'],
      },
    ],
    summary: {
      totalDiscovered: 100,
      cloned: 10,
      validated: 5,
      topRecommendation: 'owner/repo1',
    },
  }

  it('should generate compact markdown output', () => {
    const result = formatDigestMd(mockReport)

    // Should be concise - under 2000 characters for typical reports
    expect(result.length).toBeLessThan(2000)
  })

  it('should include top recommendation prominently', () => {
    const result = formatDigestMd(mockReport)

    expect(result).toContain('owner/repo1')
    expect(result).toContain('90%') // tier2Score as percentage
  })

  it('should include summary stats', () => {
    const result = formatDigestMd(mockReport)

    expect(result).toContain('100') // total discovered
    expect(result).toContain('5') // validated
  })

  it('should include ranked list of candidates', () => {
    const result = formatDigestMd(mockReport)

    expect(result).toContain('owner/repo1')
    expect(result).toContain('owner/repo2')
  })

  it('should not include verbose methodology section', () => {
    const result = formatDigestMd(mockReport)

    expect(result).not.toContain('Scoring Methodology')
    expect(result).not.toContain('Tier1 Score')
  })
})
