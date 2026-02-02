import { describe, it, expect, vi, beforeEach } from 'vitest'

const launchReview = vi.fn()
const isClaudeAvailable = vi.fn()
const validateSession = vi.fn()
const skipReview = vi.fn()
const closeDb = vi.fn()

vi.mock('../../src/review/launcher.js', () => ({
  launchReview,
  isClaudeAvailable,
  validateSession,
  skipReview,
}))

vi.mock('../../src/watch/db.js', () => ({
  getPendingReviewSessions: vi.fn().mockResolvedValue([]),
  getTrackedRepoById: vi.fn().mockResolvedValue(null),
  closeDb,
}))

const { runReview } = await import('../../src/commands/review.js')

describe('commands/review', () => {
  beforeEach(() => {
    launchReview.mockReset()
    isClaudeAvailable.mockReset()
    validateSession.mockReset()
    skipReview.mockReset()
    closeDb.mockReset()
  })

  it('runs review when session is provided without --run flag', async () => {
    isClaudeAvailable.mockResolvedValue(true)
    validateSession.mockResolvedValue({ valid: true })
    launchReview.mockResolvedValue({ success: true, exitCode: 0 })

    await runReview({ session: '/tmp/session' })

    expect(launchReview).toHaveBeenCalledTimes(1)
  })
})
