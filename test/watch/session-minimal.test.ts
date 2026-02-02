import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm, readFile, access, constants } from 'node:fs/promises'

const testRoot = join(tmpdir(), 'scout-session-minimal-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testRoot, type),
}))

const { createMinimalSession } = await import('../../src/watch/session-minimal.js')

describe('watch/session-minimal', () => {
  beforeEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
    await mkdir(testRoot, { recursive: true })
  })

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true })
  })

  it('creates a session directory with context and output path', async () => {
    const result = await createMinimalSession({
      repo: 'owner/repo',
      url: 'https://github.com/owner/repo',
      oldSha: 'old-sha',
      newSha: 'new-sha',
      targetKind: 'cli',
      trackedPaths: ['src/cli'],
    })

    await access(join(result.sessionPath, 'OUTPUT'), constants.F_OK)
    const context = JSON.parse(await readFile(join(result.sessionPath, 'review_context.json'), 'utf-8'))
    expect(context.repo).toBe('owner/repo')
    expect(context.oldSha).toBe('old-sha')
    expect(context.newSha).toBe('new-sha')
  })
})
