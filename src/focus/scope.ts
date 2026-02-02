/**
 * Scope and depth budget management for focus bundles.
 * @module focus/scope
 */

import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { FocusFile } from '../schemas/index.js'

/** Extensions to include in scope */
const INCLUDED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.yaml', '.yml', '.toml',
])

/** Directories to always skip */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '__pycache__', '.venv', '.next', '.nuxt',
])

/**
 * Collects files within scope roots with depth budget.
 */
export async function collectScopeFiles(
  repoPath: string,
  scopeRoots: string[],
  maxDirs: number,
  maxFilesPerDir: number
): Promise<FocusFile[]> {
  const files: FocusFile[] = []
  let dirsVisited = 0

  for (const root of scopeRoots) {
    if (dirsVisited >= maxDirs) break

    const rootPath = join(repoPath, root)

    try {
      await collectFilesRecursive(
        rootPath,
        repoPath,
        files,
        { dirsVisited: 0, maxDirs, maxFilesPerDir }
      )
      dirsVisited++
    } catch {
      // Root doesn't exist
    }
  }

  // Sort by size (smaller first, as they're often more focused)
  files.sort((a, b) => a.sizeBytes - b.sizeBytes)

  return files
}

interface CollectState {
  dirsVisited: number
  maxDirs: number
  maxFilesPerDir: number
}

async function collectFilesRecursive(
  dirPath: string,
  repoPath: string,
  files: FocusFile[],
  state: CollectState,
  depth = 0
): Promise<void> {
  if (depth > 5 || state.dirsVisited >= state.maxDirs) return

  state.dirsVisited++

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    let filesInDir = 0

    // Process files first
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (filesInDir >= state.maxFilesPerDir) break

      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (!INCLUDED_EXTENSIONS.has(ext)) continue

      const fullPath = join(dirPath, entry.name)
      const relativePath = relative(repoPath, fullPath)

      try {
        const s = await stat(fullPath)
        files.push({
          path: relativePath,
          sizeBytes: s.size,
        })
        filesInDir++
      } catch {
        // Can't stat
      }
    }

    // Then process directories
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKIP_DIRS.has(entry.name)) continue
      if (entry.name.startsWith('.')) continue

      await collectFilesRecursive(
        join(dirPath, entry.name),
        repoPath,
        files,
        state,
        depth + 1
      )
    }
  } catch {
    // Can't read directory
  }
}

/**
 * Deduplicates scope roots by removing nested paths.
 */
export function deduplicateScopeRoots(roots: string[]): string[] {
  const sorted = [...roots].sort((a, b) => a.length - b.length)
  const result: string[] = []

  for (const root of sorted) {
    // Check if this root is already covered by an existing root
    const isNested = result.some((existing) =>
      root === existing || root.startsWith(existing + '/')
    )

    if (!isNested) {
      result.push(root)
    }
  }

  return result
}
