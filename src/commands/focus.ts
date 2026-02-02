/**
 * Focus command - Generate depth-budgeted context bundles for agentic exploration.
 * @module commands/focus
 *
 * Outputs per repo:
 * - FOCUS.md: Human-readable focus bundle
 * - FOCUS.json: Machine-readable focus bundle
 * - RUN_HINTS.md: Scripts and build tool info
 * - PROVENANCE.md: Provenance and scoring info
 *
 * Also outputs:
 * - focus-index.md: Index of all generated bundles
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../config.js'
import {
  generateBundle,
  generateProvenance,
  generateRunHints,
  formatFocusMd,
  formatProvenanceMd,
  formatRunHintsMd,
} from '../focus/bundle.js'
import {
  ValidationSummarySchema,
  CloneManifestSchema,
  FocusBundleSchema,
  ProvenanceSchema,
  RunHintsSchema,
  FocusIndexSchema,
  type ValidationSummary,
  type CloneManifest,
  type FocusIndex,
} from '../schemas/index.js'

export interface FocusFlags {
  validated?: string
  out?: string
}

const TOOL_VERSION = '0.1.0'

export async function runFocus(flags: FocusFlags): Promise<void> {
  const outputDir = resolve(flags.out ?? join(process.cwd(), '.scout'))
  const runId = randomUUID().slice(0, 8)

  console.log(`📦 Generating focus bundles...`)

  // Load configuration
  const config = await loadConfig(process.cwd())

  // Load validation summary
  const summaryPath = flags.validated ?? join(outputDir, 'validate-summary.json')
  let summary: ValidationSummary

  try {
    const content = await readFile(summaryPath, 'utf-8')
    summary = ValidationSummarySchema.parse(JSON.parse(content))
    console.log(`  → Loaded ${summary.results.length} validated repos from ${summaryPath}`)
  } catch {
    console.error(`❌ Error: Could not load validation summary from ${summaryPath}`)
    console.error('   Run "scout validate" first')
    process.exit(1)
  }

  // Load clone manifest for SHA info
  const manifestPath = join(outputDir, 'clone-manifest.json')
  let manifest: CloneManifest | null = null

  try {
    const content = await readFile(manifestPath, 'utf-8')
    manifest = CloneManifestSchema.parse(JSON.parse(content))
  } catch {
    // Not critical
  }

  // Create focus output directory
  const focusDir = join(outputDir, 'focus')
  await mkdir(focusDir, { recursive: true })

  // Track generated bundles for index
  const indexEntries: FocusIndex['repos'] = []

  // Generate bundles for each validated repo
  for (const result of summary.results) {
    const [owner, repo] = result.repo.split('/')
    if (!owner || !repo) continue

    console.log(`  → ${result.repo}`)

    // Create repo output directory
    const repoDir = join(focusDir, owner, repo)
    await mkdir(repoDir, { recursive: true })

    // Generate bundle
    const bundle = await generateBundle(result, config)
    console.log(`    Entrypoints: ${bundle.entrypoints.length}`)
    console.log(`    Files: ${bundle.files.length}`)

    // Validate and write FOCUS.json
    const validatedBundle = FocusBundleSchema.parse(bundle)
    await writeFile(
      join(repoDir, 'FOCUS.json'),
      JSON.stringify(validatedBundle, null, 2)
    )

    // Generate and write run hints
    const runHints = await generateRunHints(result.localPath)
    const validatedRunHints = RunHintsSchema.parse(runHints)
    await writeFile(
      join(repoDir, 'RUN_HINTS.md'),
      formatRunHintsMd(validatedRunHints, result.repo)
    )

    // Write FOCUS.md
    await writeFile(
      join(repoDir, 'FOCUS.md'),
      formatFocusMd(bundle, runHints)
    )

    // Get SHA from manifest
    const manifestEntry = manifest?.entries.find((e) => e.repo === result.repo)
    const sha = manifestEntry?.sha ?? 'unknown'

    // Get license from validation (we'll need to fetch from discovery data or infer)
    // For now, just use null
    const license = null

    // Generate and write provenance
    const provenance = generateProvenance(result, sha, license, TOOL_VERSION, runId)
    const validatedProvenance = ProvenanceSchema.parse(provenance)
    await writeFile(
      join(repoDir, 'PROVENANCE.md'),
      formatProvenanceMd(validatedProvenance)
    )
    await writeFile(
      join(repoDir, 'PROVENANCE.json'),
      JSON.stringify(validatedProvenance, null, 2)
    )

    // Add to index
    indexEntries.push({
      repo: result.repo,
      tier2Score: result.tier2Score,
      bundlePath: join('focus', owner, repo),
    })
  }

  // Generate and write index
  const focusIndex: FocusIndex = {
    timestamp: new Date().toISOString(),
    runId,
    repos: indexEntries.sort((a, b) => b.tier2Score - a.tier2Score),
  }

  const validatedIndex = FocusIndexSchema.parse(focusIndex)
  await writeFile(
    join(outputDir, 'focus-index.json'),
    JSON.stringify(validatedIndex, null, 2)
  )

  // Write focus-index.md
  const indexMd = generateIndexMd(validatedIndex)
  await writeFile(join(outputDir, 'focus-index.md'), indexMd)

  console.log('')
  console.log(`✅ Focus generation complete.`)
  console.log(`   Generated ${indexEntries.length} bundles`)
  console.log(`   Index: ${join(outputDir, 'focus-index.md')}`)
  console.log('')
  console.log(`   Next: scout compare --validated ${summaryPath} --focus ${join(outputDir, 'focus-index.json')}`)
}

/**
 * Generates focus-index.md markdown.
 */
function generateIndexMd(index: FocusIndex): string {
  const lines: string[] = []

  lines.push('# Focus Index')
  lines.push('')
  lines.push(`Generated: ${index.timestamp}`)
  lines.push(`Run ID: ${index.runId}`)
  lines.push('')
  lines.push('## Repositories')
  lines.push('')
  lines.push('| Rank | Repository | Tier2 Score | Bundle |')
  lines.push('|------|------------|-------------|--------|')

  for (const [i, entry] of index.repos.entries()) {
    const score = Math.round(entry.tier2Score * 100)
    lines.push(`| ${i + 1} | ${entry.repo} | ${score}% | [Focus](${entry.bundlePath}/FOCUS.md) |`)
  }

  lines.push('')

  return lines.join('\n')
}
