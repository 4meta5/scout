import { describe, it, expect, vi } from 'vitest'

const execa = vi.fn().mockResolvedValue({ stdout: 'abc123\tHEAD\n' })

vi.mock('execa', () => ({ execa }))

const { fetchRemoteHead } = await import('../../src/watch/remote.js')

describe('watch/remote', () => {
  it('parses HEAD sha from git ls-remote output', async () => {
    const sha = await fetchRemoteHead('https://github.com/owner/repo.git')
    expect(sha).toBe('abc123')
  })
})
