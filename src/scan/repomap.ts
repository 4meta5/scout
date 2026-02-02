/**
 * Repository map generation for context.
 * @module scan/repomap
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

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
  '.scout',
])

/** Max depth for repomap */
const MAX_DEPTH = 4

/** Max entries per directory */
const MAX_ENTRIES_PER_DIR = 20

/** Max total entries */
const MAX_TOTAL_ENTRIES = 500

interface TreeEntry {
  name: string
  isDir: boolean
  children?: TreeEntry[]
}

/**
 * Builds a directory tree structure.
 */
async function buildTree(
  dir: string,
  root: string,
  depth: number,
  totalCount: { value: number }
): Promise<TreeEntry[]> {
  if (depth > MAX_DEPTH || totalCount.value > MAX_TOTAL_ENTRIES) {
    return []
  }

  const entries: TreeEntry[] = []

  try {
    const items = await readdir(dir, { withFileTypes: true })

    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    let count = 0
    for (const item of items) {
      if (count >= MAX_ENTRIES_PER_DIR || totalCount.value > MAX_TOTAL_ENTRIES) {
        if (items.length > count) {
          entries.push({ name: `... (${items.length - count} more)`, isDir: false })
        }
        break
      }

      const name = item.name

      // Skip hidden files (except specific ones)
      if (name.startsWith('.') && !['SKILL.md', '.claude', '.github'].some((k) => name.includes(k))) {
        continue
      }

      // Skip ignored directories
      if (item.isDirectory() && IGNORE_DIRS.has(name)) {
        continue
      }

      totalCount.value++
      count++

      if (item.isDirectory()) {
        const children = await buildTree(join(dir, name), root, depth + 1, totalCount)
        entries.push({ name, isDir: true, children })
      } else {
        entries.push({ name, isDir: false })
      }
    }
  } catch {
    // Permission denied or other error
  }

  return entries
}

/**
 * Formats tree entries as text.
 */
function formatTree(entries: TreeEntry[], prefix = '', _isLast = true): string {
  const lines: string[] = []

  for (const [i, entry] of entries.entries()) {
    const isEntryLast = i === entries.length - 1
    const connector = isEntryLast ? '└── ' : '├── '
    const childPrefix = isEntryLast ? '    ' : '│   '

    const icon = entry.isDir ? '📁 ' : '📄 '
    lines.push(`${prefix}${connector}${icon}${entry.name}`)

    if (entry.children && entry.children.length > 0) {
      lines.push(formatTree(entry.children, prefix + childPrefix, isEntryLast))
    }
  }

  return lines.join('\n')
}

/**
 * Generates a text-based repository map.
 */
export async function generateRepomap(root: string): Promise<string> {
  const totalCount = { value: 0 }
  const tree = await buildTree(root, root, 0, totalCount)

  const header = `# Repository Map
# Generated: ${new Date().toISOString()}
# Root: ${root}
# Entries: ${totalCount.value}
# Max depth: ${MAX_DEPTH}

`

  return header + formatTree(tree)
}
