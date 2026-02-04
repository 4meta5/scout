/**
 * Drift detection for tracked paths.
 * @module watch/drift
 *
 * Detects when tracked paths have been renamed, moved, or deleted
 * to help users understand structural changes in the codebase.
 */

import { getChangedFilesWithStatus } from './diff.js'
import type { DriftEntry, TrackedPath } from '@4meta5/scout'

/**
 * Result of drift detection.
 */
export interface DriftResult {
  /** List of drift entries for tracked paths */
  entries: DriftEntry[]
  /** Whether any drift was detected */
  hasDrift: boolean
  /** Markdown summary of drift */
  summary: string
}

/**
 * Detects drift in tracked paths between two commits.
 *
 * Drift occurs when:
 * - A tracked path is renamed to a new location
 * - A tracked path is deleted
 * - A tracked path is moved to a different directory
 */
export async function detectDrift(
  repoPath: string,
  oldSha: string,
  newSha: string,
  trackedPaths: Array<Pick<TrackedPath, 'path' | 'kind'>>
): Promise<DriftResult> {
  if (trackedPaths.length === 0) {
    return {
      entries: [],
      hasDrift: false,
      summary: '',
    }
  }

  // Get all file changes with rename detection
  const changes = await getChangedFilesWithStatus(repoPath, oldSha, newSha, 50)

  const entries: DriftEntry[] = []
  const trackedPathSet = new Set(trackedPaths.map(p => p.path))

  for (const change of changes) {
    // Check if this change affects a tracked path
    const affectsTracked = isPathAffected(change.oldPath, trackedPathSet)

    if (!affectsTracked) continue

    if (change.status === 'D') {
      // Deletion
      entries.push({
        oldPath: change.oldPath,
        newPath: null,
        type: 'deleted',
      })
    } else if (change.status === 'R' && change.newPath !== undefined) {
      // Rename
      const oldDir = getDirectory(change.oldPath)
      const newDir = getDirectory(change.newPath)

      entries.push({
        oldPath: change.oldPath,
        newPath: change.newPath,
        type: oldDir !== newDir ? 'moved' : 'renamed',
        similarity: change.similarity,
      })
    }
  }

  // Also check for directory-level drift
  const dirDrift = detectDirectoryDrift(changes, trackedPathSet)
  entries.push(...dirDrift)

  // Dedupe entries by oldPath
  const seen = new Set<string>()
  const uniqueEntries = entries.filter(e => {
    if (seen.has(e.oldPath)) return false
    seen.add(e.oldPath)
    return true
  })

  return {
    entries: uniqueEntries,
    hasDrift: uniqueEntries.length > 0,
    summary: generateDriftSummary(uniqueEntries),
  }
}

/**
 * Checks if a file path affects a tracked path.
 * Handles both exact matches and files within tracked directories.
 */
function isPathAffected(filePath: string, trackedPaths: Set<string>): boolean {
  // Exact match
  if (trackedPaths.has(filePath)) return true

  // Check if file is within a tracked directory
  for (const tracked of trackedPaths) {
    if (filePath.startsWith(tracked + '/')) return true
  }

  return false
}

/**
 * Gets the directory portion of a path.
 */
function getDirectory(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/')
  return lastSlash === -1 ? '' : filePath.slice(0, lastSlash)
}

/**
 * Detects when entire directories have moved.
 */
function detectDirectoryDrift(
  changes: Array<{ status: string; oldPath: string; newPath?: string | undefined }>,
  trackedPaths: Set<string>
): DriftEntry[] {
  const entries: DriftEntry[] = []

  // Group renames by old directory
  const renamesByOldDir = new Map<string, Array<{ oldPath: string; newPath: string }>>()

  for (const change of changes) {
    if (change.status === 'R' && change.newPath !== undefined) {
      const oldDir = getDirectory(change.oldPath)
      if (!renamesByOldDir.has(oldDir)) {
        renamesByOldDir.set(oldDir, [])
      }
      const dirRenames = renamesByOldDir.get(oldDir)
      if (dirRenames !== undefined) {
        dirRenames.push({
          oldPath: change.oldPath,
          newPath: change.newPath,
        })
      }
    }
  }

  // Check if any tracked directory has been moved
  for (const tracked of trackedPaths) {
    const renames = renamesByOldDir.get(tracked)
    if (renames === undefined || renames.length === 0) continue

    // Check if all files moved to same new directory
    const newDirs = new Set(renames.map(r => getDirectory(r.newPath)))
    if (newDirs.size === 1) {
      const newDir = [...newDirs][0] ?? null
      if (newDir !== null && newDir !== tracked) {
        entries.push({
          oldPath: tracked,
          newPath: newDir,
          type: 'moved',
        })
      }
    }
  }

  return entries
}

/**
 * Generates a markdown summary of drift.
 */
function generateDriftSummary(entries: DriftEntry[]): string {
  if (entries.length === 0) return ''

  const lines: string[] = [
    '# Tracked Path Drift Detected',
    '',
    'The following tracked paths have changed location or been removed:',
    '',
  ]

  const renamed = entries.filter(e => e.type === 'renamed')
  const moved = entries.filter(e => e.type === 'moved')
  const deleted = entries.filter(e => e.type === 'deleted')

  if (renamed.length > 0) {
    lines.push('## Renamed')
    for (const e of renamed) {
      const similarity = e.similarity !== undefined ? ` (${e.similarity}% similar)` : ''
      lines.push(`- \`${e.oldPath}\` → \`${e.newPath}\`${similarity}`)
    }
    lines.push('')
  }

  if (moved.length > 0) {
    lines.push('## Moved')
    for (const e of moved) {
      const similarity = e.similarity !== undefined ? ` (${e.similarity}% similar)` : ''
      lines.push(`- \`${e.oldPath}\` → \`${e.newPath}\`${similarity}`)
    }
    lines.push('')
  }

  if (deleted.length > 0) {
    lines.push('## Deleted')
    for (const e of deleted) {
      lines.push(`- \`${e.oldPath}\``)
    }
    lines.push('')
  }

  lines.push('## Impact')
  lines.push('')
  lines.push('These changes may affect the focus of your security review.')
  lines.push('Consider updating tracked paths if the new locations are still relevant.')

  return lines.join('\n')
}

/**
 * Maps old tracked paths to new paths based on drift detection.
 */
export function mapDriftedPaths(
  originalPaths: string[],
  driftEntries: DriftEntry[]
): Map<string, string | null> {
  const mapping = new Map<string, string | null>()

  for (const path of originalPaths) {
    const drift = driftEntries.find(d => d.oldPath === path)
    if (drift !== undefined) {
      mapping.set(path, drift.newPath)
    } else {
      mapping.set(path, path)
    }
  }

  return mapping
}
