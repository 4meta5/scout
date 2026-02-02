import { describe, it, expect, vi, beforeEach } from 'vitest'

const runWatchOnce = vi.fn().mockResolvedValue(undefined)
const createWatchSession = vi.fn().mockResolvedValue({ sessionPath: '/tmp/session', driftFlag: false })
const launchReview = vi.fn().mockResolvedValue({ success: true, exitCode: 0 })

vi.mock('../../src/watch/run-once.js', () => ({
  runWatchOnce,
}))

vi.mock('../../src/watch/session-watch.js', () => ({
  createWatchSession,
}))

vi.mock('../../src/watch/remote.js', () => ({
  fetchRemoteHead: vi.fn().mockResolvedValue('new-sha'),
}))

vi.mock('../../src/review/launcher.js', () => ({
  launchReview,
}))

vi.mock('../../src/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    watch: {
      maxTokens: 9000,
      maxFilesPerChunk: 2,
      excludePatterns: [':!secrets.env'],
      reviewTimeoutMs: 1000,
    },
  }),
}))

const { runWatchRunOnce } = await import('../../src/commands/watch-run-once.js')

describe('commands/watch-run-once', () => {
  beforeEach(() => {
    runWatchOnce.mockClear()
    createWatchSession.mockClear()
    launchReview.mockClear()
  })

  it('passes sinceLast flag to runWatchOnce', async () => {
    await runWatchRunOnce({ sinceLast: true })
    expect(runWatchOnce).toHaveBeenCalledWith(expect.objectContaining({ sinceLast: true }))
  })

  it('wires watch config into createWatchSession', async () => {
    await runWatchRunOnce({ sinceLast: false })
    const args = runWatchOnce.mock.calls[0]?.[0]
    expect(args).toBeTruthy()

    await args.createSession({
      repoFullName: 'owner/repo',
      repoUrl: 'https://github.com/owner/repo.git',
      fromSha: 'old-sha',
      toSha: 'new-sha',
      targetKind: 'cli',
      trackedPaths: ['src/cli'],
    })

    expect(createWatchSession).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 9000,
      maxFilesPerChunk: 2,
      excludePatterns: [':!secrets.env'],
    }))
  })

  it('passes autoReview flag into runWatchOnce', async () => {
    await runWatchRunOnce({ autoReview: true })
    expect(runWatchOnce).toHaveBeenCalledWith(expect.objectContaining({ autoReview: true }))
  })

  it('invokes auto-review launcher when enabled', async () => {
    await runWatchRunOnce({ autoReview: true })
    const args = runWatchOnce.mock.calls[0]?.[0]
    expect(args).toBeTruthy()

    await args.onSessionCreated?.('/tmp/session')
    expect(launchReview).toHaveBeenCalledWith(expect.objectContaining({
      sessionPath: '/tmp/session',
      interactive: false,
      timeout: 1000,
    }))
  })
})
