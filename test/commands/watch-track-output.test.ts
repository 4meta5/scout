import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertRepoV2 = vi.fn().mockResolvedValue(1)
const upsertTrackedV2 = vi.fn().mockResolvedValue(2)
const listTrackedV2 = vi.fn().mockResolvedValue([
  {
    repoFullName: 'owner/repo',
    repoUrl: 'https://github.com/owner/repo.git',
    targetKind: 'cli',
    trackedPaths: ['src/cli', 'src/bin'],
    enabled: true,
    intervalHours: 24,
  },
])
const removeTrackedV2 = vi.fn().mockResolvedValue(true)

vi.mock('../../src/watch/db.js', () => ({
  insertRepoV2,
  upsertTrackedV2,
  listTrackedV2,
  removeTrackedV2,
  closeDb: vi.fn(),
}))

vi.mock('../../src/clone/hardened.js', () => ({
  normalizeGitUrl: (input: string) => `https://github.com/${input}.git`,
}))

const { runWatchAdd, runWatchList, runWatchRemove } = await import('../../src/commands/watch-track.js')

describe('commands/watch-track output', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    logSpy.mockClear()
    errorSpy.mockClear()
  })

  it('prints summary on add', async () => {
    await runWatchAdd({
      repo: 'owner/repo',
      targetKind: 'cli',
      paths: ['src/cli', 'src/bin'],
    })

    expect(logSpy).toHaveBeenCalled()
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('Added')
    expect(output).toContain('owner/repo')
  })

  it('prints list rows', async () => {
    await runWatchList()
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('owner/repo')
    expect(output).toContain('cli')
  })

  it('prints removed confirmation', async () => {
    await runWatchRemove({ repo: 'owner/repo', targetKind: 'cli' })
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('Removed')
  })

  it('prints json for list when requested', async () => {
    await runWatchList({ json: true })
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('"repoFullName":"owner/repo"')
    expect(output).toContain('"targetKind":"cli"')
  })

  it('prints json for add/remove when requested', async () => {
    await runWatchAdd({
      repo: 'owner/repo',
      targetKind: 'cli',
      paths: ['src/cli'],
      json: true,
    })
    await runWatchRemove({ repo: 'owner/repo', targetKind: 'cli', json: true })
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('"action":"add"')
    expect(output).toContain('"action":"remove"')
    expect(output).toContain('"intervalHours"')
    expect(output).toContain('"repoUrl"')
  })

  it('prints json for list when format is json', async () => {
    await runWatchList({ format: 'json' })
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('"repoFullName":"owner/repo"')
  })

  it('prints table header in human-readable list', async () => {
    await runWatchList()
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n')
    expect(output).toContain('Repo')
    expect(output).toContain('Kind')
    expect(output).toContain('Paths')
    expect(output).toContain('Interval')
    expect(output).toContain('Enabled')
  })
})
