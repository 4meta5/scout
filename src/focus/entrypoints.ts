/**
 * Entrypoint detection for focus bundles.
 * @module focus/entrypoints
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { FocusEntrypoint, ComponentKind, EntrypointCandidate } from '../schemas/index.js'

/**
 * Checks if a file exists.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

/**
 * Priority entrypoints by kind.
 */
const ENTRYPOINT_PRIORITIES: Record<ComponentKind, string[]> = {
  'mcp-server': ['src/server.ts', 'src/index.ts', 'server.ts', 'README.md'],
  'cli': ['src/cli/index.ts', 'src/cli/app.ts', 'src/cli.ts', 'bin/cli.js', 'README.md'],
  'skill': ['SKILL.md', 'README.md', 'src/index.ts', 'index.ts'],
  'hook': ['hooks/index.ts', 'src/hooks/index.ts', '.husky/pre-commit', 'README.md'],
  'plugin': ['src/plugin.ts', 'src/index.ts', 'plugin.ts', 'README.md'],
  'library': ['src/index.ts', 'lib/index.ts', 'index.ts', 'README.md'],
}

/**
 * Resolves actual entrypoints from candidates.
 */
export async function resolveEntrypoints(
  repoPath: string,
  candidates: EntrypointCandidate[],
  maxPerKind: number
): Promise<FocusEntrypoint[]> {
  const entrypoints: FocusEntrypoint[] = []
  const seen = new Set<string>()

  for (const candidate of candidates) {
    const kind = candidate.kind
    let count = 0

    // First, try candidate paths
    for (const path of candidate.paths) {
      if (count >= maxPerKind) break
      const fullPath = join(repoPath, path)

      if (await fileExists(fullPath)) {
        if (!seen.has(path)) {
          seen.add(path)
          entrypoints.push({
            kind,
            path,
            reason: 'Candidate from validation',
          })
          count++
        }
      }
    }

    // Then, try priority paths for this kind
    const priorities = ENTRYPOINT_PRIORITIES[kind]
    for (const path of priorities) {
      if (count >= maxPerKind) break
      const fullPath = join(repoPath, path)

      if (await fileExists(fullPath)) {
        if (!seen.has(path)) {
          seen.add(path)
          entrypoints.push({
            kind,
            path,
            reason: `Priority entrypoint for ${kind}`,
          })
          count++
        }
      }
    }
  }

  // Always include README.md if it exists and not already included
  if (!seen.has('README.md')) {
    if (await fileExists(join(repoPath, 'README.md'))) {
      entrypoints.unshift({
        kind: 'library',
        path: 'README.md',
        reason: 'Project documentation',
      })
    }
  }

  return entrypoints
}

/**
 * Finds high-import files within focus roots.
 */
export async function findBarrelFiles(
  repoPath: string,
  focusRoots: string[]
): Promise<string[]> {
  const barrels: string[] = []

  for (const root of focusRoots) {
    const rootPath = join(repoPath, root)

    try {
      const entries = await readdir(rootPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile()) continue

        // Index files are likely barrels
        if (entry.name === 'index.ts' || entry.name === 'index.js') {
          barrels.push(join(root, entry.name))
        }

        // mod.ts (Deno style)
        if (entry.name === 'mod.ts') {
          barrels.push(join(root, entry.name))
        }
      }
    } catch {
      // Root doesn't exist
    }
  }

  return barrels
}
