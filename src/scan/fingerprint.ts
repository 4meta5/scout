/**
 * Project fingerprinting logic.
 * @module scan/fingerprint
 */

import { readdir, stat, readFile } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { execSync } from 'node:child_process'
import type { Fingerprint } from '../schemas/index.js'

/** Language extension mappings */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.h': 'C',
  '.hpp': 'C++',
  '.swift': 'Swift',
  '.scala': 'Scala',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
}

/** Key markers to look for */
const KEY_MARKERS = [
  'SKILL.md',
  'skills/',
  'hooks/',
  'plugins/',
  'mcp.json',
  '.mcp/',
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  '.eslintrc',
  'eslint.config.js',
  'eslint.config.mjs',
  '.prettierrc',
  'CLAUDE.md',
  '.claude/',
]

/** Directories to ignore */
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
  'coverage',
])

/**
 * Gets the current git HEAD commit SHA.
 */
function getGitCommit(root: string): string | undefined {
  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return sha || undefined
  } catch {
    return undefined
  }
}

/**
 * Checks if a path should be ignored based on gitignore patterns.
 */
async function loadGitignore(root: string): Promise<Set<string>> {
  const ignored = new Set<string>()
  try {
    const content = await readFile(join(root, '.gitignore'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        ignored.add(trimmed.replace(/\/$/, ''))
      }
    }
  } catch {
    // No .gitignore
  }
  return ignored
}

/**
 * Recursively walks a directory, respecting ignores.
 */
async function* walkDirectory(
  dir: string,
  root: string,
  gitignored: Set<string>,
  maxDepth = 10,
  currentDepth = 0
): AsyncGenerator<{ path: string; isDir: boolean }> {
  if (currentDepth > maxDepth) return

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const name = entry.name
      const fullPath = join(dir, name)
      const relativePath = relative(root, fullPath)

      // Skip ignored directories
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(name) || gitignored.has(name) || gitignored.has(relativePath)) {
          continue
        }
        yield { path: relativePath, isDir: true }
        yield* walkDirectory(fullPath, root, gitignored, maxDepth, currentDepth + 1)
      } else {
        if (!gitignored.has(name) && !gitignored.has(relativePath)) {
          yield { path: relativePath, isDir: false }
        }
      }
    }
  } catch {
    // Permission denied or other error
  }
}

/**
 * Generates a fingerprint for a project.
 */
export async function generateFingerprint(root: string): Promise<Fingerprint> {
  const languageCounts: Record<string, number> = {}
  const keyMarkers: string[] = []
  const gitignored = await loadGitignore(root)

  // Walk the directory
  for await (const { path, isDir } of walkDirectory(root, root, gitignored)) {
    // Check for key markers
    for (const marker of KEY_MARKERS) {
      if (path === marker || path === marker.replace(/\/$/, '') || path.endsWith(`/${marker}`)) {
        if (!keyMarkers.includes(marker)) {
          keyMarkers.push(marker)
        }
      }
    }

    // Count languages (files only)
    if (!isDir) {
      const ext = extname(path).toLowerCase()
      const language = LANGUAGE_EXTENSIONS[ext]
      if (language) {
        languageCounts[language] = (languageCounts[language] ?? 0) + 1
      }
    }
  }

  // Check root-level markers that might be directories
  for (const marker of KEY_MARKERS) {
    try {
      const markerPath = join(root, marker.replace(/\/$/, ''))
      const s = await stat(markerPath)
      if (s.isFile() || s.isDirectory()) {
        if (!keyMarkers.includes(marker)) {
          keyMarkers.push(marker)
        }
      }
    } catch {
      // Doesn't exist
    }
  }

  return {
    root,
    commit: getGitCommit(root),
    timestamp: new Date().toISOString(),
    languageCounts,
    keyMarkers: keyMarkers.sort(),
  }
}
