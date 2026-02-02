/**
 * Clone manifest management.
 * @module clone/manifest
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { CloneManifest, CloneEntry } from '../schemas/index.js'
import { CloneManifestSchema } from '../schemas/index.js'

/**
 * Creates a new clone manifest.
 */
export function createManifest(runId: string, requested: number): CloneManifest {
  return {
    timestamp: new Date().toISOString(),
    runId,
    requested,
    cloned: 0,
    entries: [],
  }
}

/**
 * Adds an entry to the manifest.
 */
export function addEntry(manifest: CloneManifest, entry: CloneEntry): void {
  manifest.entries.push(entry)
  manifest.cloned = manifest.entries.length
}

/**
 * Saves a manifest to disk.
 */
export async function saveManifest(manifest: CloneManifest, path: string): Promise<void> {
  const validated = CloneManifestSchema.parse(manifest)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(validated, null, 2))
}

/**
 * Loads a manifest from disk.
 */
export async function loadManifest(path: string): Promise<CloneManifest> {
  const content = await readFile(path, 'utf-8')
  return CloneManifestSchema.parse(JSON.parse(content))
}
