/**
 * Remote git helpers for watch mode.
 * @module watch/remote
 */

import { execa } from 'execa'

const GIT_SAFE_OPTIONS = ['-c', 'core.hooksPath=/dev/null']

export async function fetchRemoteHead(url: string): Promise<string> {
  const result = await execa('git', [
    ...GIT_SAFE_OPTIONS,
    'ls-remote',
    url,
    'HEAD',
  ])

  const line = result.stdout.trim().split('\n')[0] ?? ''
  const [sha] = line.split(/\s+/)
  if (sha === undefined || sha === '') {
    throw new Error(`Unable to resolve HEAD for ${url}`)
  }
  return sha
}
