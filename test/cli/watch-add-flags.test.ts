import { describe, it, expect, vi } from 'vitest'
import { run, text_en } from '@stricli/core'

const runWatchAdd = vi.fn().mockResolvedValue(undefined)

vi.mock('../../src/commands/watch-track.js', () => ({
  runWatchAdd,
}))

const { app } = await import('../../src/cli/app.js')

function makeContext() {
  return {
    text: text_en,
    process: {
      stdout: { write: vi.fn() },
      stderr: { write: vi.fn() },
      exitCode: null,
    },
  }
}

describe('cli watch add flags', () => {
  it('accepts repeated --paths flags', async () => {
    await run(app, ['watch', 'add', '--repo', 'owner/repo', '--targetKind', 'cli', '--paths', 'src/cli', '--paths', 'src/bin'], makeContext())

    expect(runWatchAdd).toHaveBeenCalledWith(expect.objectContaining({
      paths: ['src/cli', 'src/bin'],
    }))
  })

  it('accepts kebab-case flags', async () => {
    await run(app, ['watch', 'add', '--repo', 'owner/repo', '--target-kind', 'cli', '--interval-hours', '12', '--paths', 'src/cli'], makeContext())

    expect(runWatchAdd).toHaveBeenCalledWith(expect.objectContaining({
      'target-kind': 'cli',
      'interval-hours': 12,
    }))
  })
})
