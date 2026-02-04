import { describe, it, expect } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const { getExcludePatterns } = await import('../../src/watch/diff.js')

describe('watch/diff exclude patterns', () => {
  it('merges config excludes with .scoutignore entries', async () => {
    const repoDir = join(tmpdir(), 'scout-diff-test-' + Date.now())
    await mkdir(repoDir, { recursive: true })
    await writeFile(
      join(repoDir, '.scoutignore'),
      ['# comment', '', 'dist/', '*.lock', 'assets/*.png'].join('\n')
    )

    const patterns = await getExcludePatterns(repoDir, ['node_modules/', '*.map'])

    expect(patterns).toContain(':!dist/')
    expect(patterns).toContain(':!*.lock')
    expect(patterns).toContain(':!assets/*.png')
    expect(patterns).toContain(':!node_modules/')
    expect(patterns).toContain(':!*.map')
  })
})
