import { describe, it, expect } from 'vitest'
import { inferTargets } from '../src/scan/targets.js'
import type { Fingerprint } from '../src/schemas/index.js'

/**
 * Checks if a number has floating point artifacts (more than 2 decimal places)
 * e.g., 0.6 is clean, 0.6000000000000001 is not
 */
function hasFloatingPointArtifact(n: number): boolean {
  const str = n.toString()
  const decimalPart = str.split('.')[1]
  return decimalPart !== undefined && decimalPart.length > 2
}

describe('inferTargets', () => {
  describe('confidence precision', () => {
    it('should return confidence values without floating point artifacts', async () => {
      // Use the actual scout project which has .claude/hooks and triggers 0.4 + 0.2
      const fingerprint: Fingerprint = {
        root: process.cwd(),
        timestamp: new Date().toISOString(),
        languageCounts: { TypeScript: 41, JavaScript: 1 },
        keyMarkers: [
          '.claude/',
          'CLAUDE.md',
          'SKILL.md',
          'eslint.config.js',
          'package.json',
          'tsconfig.json',
        ],
      }

      const targets = await inferTargets(process.cwd(), fingerprint)

      // Check that all confidence values are clean decimals
      for (const target of targets) {
        const hasArtifact = hasFloatingPointArtifact(target.confidence)
        expect(
          hasArtifact,
          `${target.kind} confidence ${target.confidence} has floating point artifact`
        ).toBe(false)
      }
    })

    it('arithmetic 0.4 + 0.2 should equal 0.6 exactly (regression test)', () => {
      // This is the root cause of the floating point issue
      // JavaScript: 0.4 + 0.2 = 0.6000000000000001
      // We need to round to fix this
      const raw = 0.4 + 0.2
      const rounded = Math.round(raw * 100) / 100

      expect(rounded).toBe(0.6)
      expect(hasFloatingPointArtifact(rounded)).toBe(false)
    })

    it('should cap confidence at 1.0', async () => {
      // Fingerprint with many signals that could exceed 1.0
      const fingerprint: Fingerprint = {
        root: '/test/project',
        timestamp: new Date().toISOString(),
        languageCounts: { TypeScript: 100 },
        keyMarkers: [
          'SKILL.md',
          'skills/',
          '.claude/',
          '.claude/skills/',
          'package.json',
          'tsconfig.json',
        ],
      }

      const targets = await inferTargets('/test/project', fingerprint)

      for (const target of targets) {
        expect(target.confidence).toBeLessThanOrEqual(1.0)
        expect(target.confidence).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
