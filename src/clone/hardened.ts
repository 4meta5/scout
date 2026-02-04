/**
 * Hardened git clone operations.
 * @module clone/hardened
 *
 * CRITICAL: All git operations disable hooks via core.hooksPath=/dev/null
 */

import { execa } from 'execa'
import { access, constants } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Base git options that disable hooks for security.
 */
const GIT_SAFE_OPTIONS = ['-c', 'core.hooksPath=/dev/null']

/**
 * Checks if a directory is a git repository.
 */
export async function isGitRepo(path: string): Promise<boolean> {
  try {
    await access(join(path, '.git'), constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Gets the HEAD SHA of a git repository.
 */
export async function getHeadSha(repoPath: string): Promise<string> {
  const result = await execa('git', [...GIT_SAFE_OPTIONS, 'rev-parse', 'HEAD'], {
    cwd: repoPath,
  })
  return result.stdout.trim()
}

/**
 * Shallow clones a repository with hooks disabled.
 */
export async function shallowClone(
  url: string,
  destPath: string,
  depth = 1
): Promise<{ sha: string; cached: boolean }> {
  // Check if already cloned
  if (await isGitRepo(destPath)) {
    const sha = await getHeadSha(destPath)
    return { sha, cached: true }
  }

  // Clone with hooks disabled
  await execa('git', [
    ...GIT_SAFE_OPTIONS,
    'clone',
    '--depth', String(depth),
    '--single-branch',
    url,
    destPath,
  ])

  const sha = await getHeadSha(destPath)
  return { sha, cached: false }
}

/**
 * Converts a GitHub URL to SSH or HTTPS format.
 */
export function normalizeGitUrl(input: string): string {
  // Already a full URL
  if (input.startsWith('https://') || input.startsWith('git@')) {
    return input
  }

  // owner/repo format
  if (input.includes('/') && !input.includes(':')) {
    return `https://github.com/${input}.git`
  }

  return input
}
