/**
 * Clone command - Shallow clone discovered repos for analysis.
 * @module commands/clone
 *
 * CRITICAL: All git operations disable hooks via core.hooksPath=/dev/null
 *
 * Outputs:
 * - clone-manifest.json: Manifest of cloned repos with paths and SHAs
 */

import { readFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../config.js'
import { getRepoCachePath, ensureCacheDir } from '../cache.js'
import { shallowClone, normalizeGitUrl } from '../clone/hardened.js'
import { createManifest, addEntry, saveManifest } from '../clone/manifest.js'
import {
  CandidatesTier1Schema,
  type CandidatesTier1,
  type CloneEntry,
} from '../schemas/index.js'

export interface CloneFlags {
  in?: string
  top?: number
  out?: string
}

export async function runClone(flags: CloneFlags): Promise<void> {
  const outputDir = resolve(flags.out ?? join(process.cwd(), '.scout'))
  const runId = randomUUID().slice(0, 8)

  console.log(`📦 Cloning repositories...`)

  // Load configuration
  const config = await loadConfig(process.cwd())

  // Load candidates
  const candidatesPath = flags.in ?? join(outputDir, 'candidates.tier1.json')
  let candidates: CandidatesTier1

  try {
    const content = await readFile(candidatesPath, 'utf-8')
    candidates = CandidatesTier1Schema.parse(JSON.parse(content))
    console.log(`  → Loaded ${candidates.candidates.length} candidates from ${candidatesPath}`)
  } catch {
    console.error(`❌ Error: Could not load candidates from ${candidatesPath}`)
    console.error('   Run "scout discover" first to generate candidates')
    process.exit(1)
  }

  // Determine how many to clone
  const cloneBudget = flags.top ?? config.discovery.cloneBudget
  const toClone = candidates.candidates
    .sort((a, b) => b.tier1Score - a.tier1Score)
    .slice(0, cloneBudget)

  console.log(`  → Will clone top ${toClone.length} repositories`)

  // Create manifest
  const manifest = createManifest(runId, toClone.length)

  // Clone each repo
  for (const candidate of toClone) {
    const [owner, repo] = candidate.repo.split('/')
    if (!owner || !repo) {
      console.warn(`  ⚠ Invalid repo format: ${candidate.repo}`)
      continue
    }

    const cachePath = getRepoCachePath(owner, repo)
    console.log(`  → ${candidate.repo}`)

    try {
      // Ensure cache directory exists
      await ensureCacheDir(join(cachePath, '..'))

      // Clone (or use cached)
      const url = normalizeGitUrl(candidate.repo)
      const { sha, cached } = await shallowClone(url, cachePath)

      if (cached) {
        console.log(`    ✓ Cached (${sha.slice(0, 7)})`)
      } else {
        console.log(`    ✓ Cloned (${sha.slice(0, 7)})`)
      }

      // Add to manifest
      const entry: CloneEntry = {
        repo: candidate.repo,
        url: candidate.url,
        localPath: cachePath,
        sha,
        tier1Score: candidate.tier1Score,
      }
      addEntry(manifest, entry)
    } catch (error) {
      console.error(`    ✗ Failed: ${(error as Error).message}`)
      // Don't exit - continue with other repos
    }
  }

  // Save manifest
  await mkdir(outputDir, { recursive: true })
  const manifestPath = join(outputDir, 'clone-manifest.json')
  await saveManifest(manifest, manifestPath)

  console.log('')
  console.log(`✅ Clone complete. Cloned ${manifest.cloned}/${manifest.requested}`)
  console.log(`   Manifest: ${manifestPath}`)
  console.log('')
  console.log(`   Next: scout validate --in ${manifestPath}`)
}
