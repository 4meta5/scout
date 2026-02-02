import { describe, it, expect, vi, beforeEach } from 'vitest'

const runWatchOnce = vi.fn().mockResolvedValue(undefined)
const createWatchSession = vi.fn().mockResolvedValue({
  sessionPath: '/tmp/session',
  driftFlag: true,
  diffStats: { filesChanged: 1, insertions: 2, deletions: 3 },
})

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
  launchReview: vi.fn().mockResolvedValue({ success: true, exitCode: 0 }),
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

describe('commands/watch-run-once output', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  beforeEach(() => {
    runWatchOnce.mockClear()
    createWatchSession.mockClear()
    logSpy.mockClear()
  })

  it('prints json output when requested', async () => {
    await runWatchRunOnce({ json: true })

    const args = runWatchOnce.mock.calls[0]?.[0]
    await args.createSession({
      repoFullName: 'owner/repo',
      repoUrl: 'https://github.com/owner/repo.git',
      fromSha: 'old-sha',
      toSha: 'new-sha',
      targetKind: 'cli',
      trackedPaths: ['src/cli'],
    })
    await args.onSessionCreated?.('/tmp/session')

    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('"sessionPath":"/tmp/session"')
    expect(output).toContain('"driftFlag":true')
    expect(output).toContain('"diffStats"')
  })

  it('prints json output when format is json', async () => {
    await runWatchRunOnce({ format: 'json' })

    const args = runWatchOnce.mock.calls[0]?.[0]
    await args.createSession({
      repoFullName: 'owner/repo',
      repoUrl: 'https://github.com/owner/repo.git',
      fromSha: 'old-sha',
      toSha: 'new-sha',
      targetKind: 'cli',
      trackedPaths: ['src/cli'],
    })

    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('"sessionPath":"/tmp/session"')
  })
})
