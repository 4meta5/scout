/**
 * Hygienic diff generation for watch mode.
 * @module watch/diff
 *
 * Generates security-focused diffs with:
 * - Lockfile exclusion
 * - Binary file exclusion
 * - Rename detection
 * - Scoped paths
 */

import { execa } from 'execa'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Base git options that disable hooks for security.
 */
const GIT_SAFE_OPTIONS = ['-c', 'core.hooksPath=/dev/null']

/**
 * Patterns to exclude from diffs (hygiene).
 */
const EXCLUDE_PATTERNS = [
  // Lockfiles
  ':!*.lock',
  ':!package-lock.json',
  ':!pnpm-lock.yaml',
  ':!yarn.lock',
  ':!Cargo.lock',
  ':!poetry.lock',
  ':!Gemfile.lock',
  ':!composer.lock',
  // Binary/media files
  ':!*.png',
  ':!*.jpg',
  ':!*.jpeg',
  ':!*.gif',
  ':!*.webp',
  ':!*.ico',
  ':!*.svg',
  ':!*.woff',
  ':!*.woff2',
  ':!*.ttf',
  ':!*.eot',
  ':!*.mp3',
  ':!*.mp4',
  ':!*.webm',
  ':!*.pdf',
  ':!*.zip',
  ':!*.tar',
  ':!*.gz',
  // Build artifacts
  ':!dist/',
  ':!build/',
  ':!node_modules/',
  ':!vendor/',
  ':!.next/',
  ':!.nuxt/',
  ':!__pycache__/',
  ':!*.pyc',
  // Generated files
  ':!*.min.js',
  ':!*.min.css',
  ':!*.map',
]

function normalizeExcludePattern(pattern: string): string {
  const trimmed = pattern.trim()
  if (trimmed === '') return ''
  return trimmed.startsWith(':!') ? trimmed : `:!${trimmed}`
}

async function readScoutignore(repoPath: string): Promise<string[]> {
  try {
    const content = await readFile(join(repoPath, '.scoutignore'), 'utf-8')
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && !line.startsWith('#'))
  } catch {
    return []
  }
}

/**
 * Returns merged exclude patterns from defaults, config, and .scoutignore.
 */
export async function getExcludePatterns(
  repoPath: string,
  configExcludes: string[] = []
): Promise<string[]> {
  const scoutignore = await readScoutignore(repoPath)
  const merged = [
    ...EXCLUDE_PATTERNS,
    ...configExcludes,
    ...scoutignore,
  ]
    .map(normalizeExcludePattern)
    .filter(Boolean)

  return [...new Set(merged)]
}

/**
 * Options for generating a diff.
 */
export interface DiffOptions {
  /** Path to the repository */
  repoPath: string
  /** Old commit SHA */
  oldSha: string
  /** New commit SHA */
  newSha: string
  /** Optional: scope to specific paths */
  scopePaths?: string[] | undefined
  /** Optional: additional exclude patterns */
  excludePatterns?: string[] | undefined
  /** Whether to detect renames (default: true) */
  findRenames?: boolean | undefined
  /** Rename similarity threshold (default: 50) */
  renameThreshold?: number | undefined
}

/**
 * Result of generating a diff.
 */
export interface DiffResult {
  /** The diff patch content */
  patch: string
  /** Number of files changed */
  filesChanged: number
  /** Number of insertions */
  insertions: number
  /** Number of deletions */
  deletions: number
  /** Whether the diff is empty */
  isEmpty: boolean
}

/**
 * Generates a hygienic diff between two commits.
 *
 * Excludes lockfiles, binaries, and build artifacts.
 * Includes rename detection for tracking path changes.
 */
export async function generateDiff(options: DiffOptions): Promise<DiffResult> {
  const {
    repoPath,
    oldSha,
    newSha,
    scopePaths = [],
    excludePatterns = [],
    findRenames = true,
    renameThreshold = 50,
  } = options

  // Build git diff command
  const args = [
    ...GIT_SAFE_OPTIONS,
    'diff',
    '--no-color',
  ]

  // Add rename detection
  if (findRenames) {
    args.push(`--find-renames=${renameThreshold}`)
    args.push('--find-copies')
  }

  // Add SHA range
  args.push(oldSha, newSha)

  // Add scope separator
  args.push('--')

  // Add scope paths (if any)
  if (scopePaths.length > 0) {
    args.push(...scopePaths)
  }

  // Add exclude patterns (hygiene)
  args.push(...EXCLUDE_PATTERNS)
  args.push(...excludePatterns)

  try {
    const result = await execa('git', args, { cwd: repoPath })
    const patch = result.stdout

    // Parse stats from shortstat
    const stats = await getDiffStats(repoPath, oldSha, newSha, scopePaths, excludePatterns)

    return {
      patch,
      filesChanged: stats.filesChanged,
      insertions: stats.insertions,
      deletions: stats.deletions,
      isEmpty: patch.trim() === '',
    }
  } catch (error) {
    // Empty diff or other error - return empty result
    if (error instanceof Error && error.message.includes('fatal')) {
      throw error
    }
    return {
      patch: '',
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      isEmpty: true,
    }
  }
}

/**
 * Gets diff statistics without the full patch.
 */
async function getDiffStats(
  repoPath: string,
  oldSha: string,
  newSha: string,
  scopePaths: string[],
  excludePatterns: string[]
): Promise<{ filesChanged: number; insertions: number; deletions: number }> {
  const args = [
    ...GIT_SAFE_OPTIONS,
    'diff',
    '--shortstat',
    oldSha, newSha,
    '--',
  ]

  if (scopePaths.length > 0) {
    args.push(...scopePaths)
  }
  args.push(...EXCLUDE_PATTERNS)
  args.push(...excludePatterns)

  try {
    const result = await execa('git', args, { cwd: repoPath })
    const output = result.stdout.trim()

    // Parse: "10 files changed, 50 insertions(+), 20 deletions(-)"
    const filesMatch = output.match(/(\d+) files? changed/)
    const insertMatch = output.match(/(\d+) insertions?/)
    const deleteMatch = output.match(/(\d+) deletions?/)

    return {
      filesChanged: filesMatch?.[1] !== undefined ? parseInt(filesMatch[1], 10) : 0,
      insertions: insertMatch?.[1] !== undefined ? parseInt(insertMatch[1], 10) : 0,
      deletions: deleteMatch?.[1] !== undefined ? parseInt(deleteMatch[1], 10) : 0,
    }
  } catch {
    return { filesChanged: 0, insertions: 0, deletions: 0 }
  }
}

/**
 * Gets the list of changed files between two commits.
 */
export async function getChangedFiles(
  repoPath: string,
  oldSha: string,
  newSha: string
): Promise<string[]> {
  const args = [
    ...GIT_SAFE_OPTIONS,
    'diff',
    '--name-only',
    oldSha, newSha,
  ]

  try {
    const result = await execa('git', args, { cwd: repoPath })
    return result.stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Gets the list of changed files with their status (A/M/D/R).
 */
export async function getChangedFilesWithStatus(
  repoPath: string,
  oldSha: string,
  newSha: string,
  renameThreshold = 50
): Promise<Array<{ status: string; oldPath: string; newPath?: string | undefined; similarity?: number }>> {
  const args = [
    ...GIT_SAFE_OPTIONS,
    'diff',
    '--name-status',
    `--find-renames=${renameThreshold}`,
    oldSha, newSha,
  ]

  try {
    const result = await execa('git', args, { cwd: repoPath })
    const lines = result.stdout.trim().split('\n').filter(Boolean)

    return lines.map(line => {
      const parts = line.split('\t')
      const statusFull = parts[0] ?? ''
      const oldPath = parts[1] ?? ''

      // Handle rename/copy with similarity (e.g., "R095" or "C080")
      if (statusFull.startsWith('R') || statusFull.startsWith('C')) {
        const similarity = parseInt(statusFull.slice(1), 10) || 100
        return {
          status: statusFull[0] ?? 'R',
          oldPath,
          newPath: parts[2],
          similarity,
        }
      }

      return {
        status: statusFull,
        oldPath,
      }
    })
  } catch {
    return []
  }
}

/**
 * Applies exclude patterns to filter a file list.
 */
export function filterExcludedFiles(files: string[]): string[] {
  // Convert pathspecs to regex patterns
  const excludeRegexes = EXCLUDE_PATTERNS.map(pattern => {
    // Remove leading :!
    let p = pattern.replace(/^:!/, '')
    // Convert glob patterns to regex
    p = p
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\/$/, '/.*')
    return new RegExp(`(^|/)${p}$`)
  })

  return files.filter(file => {
    return !excludeRegexes.some(re => re.test(file))
  })
}
