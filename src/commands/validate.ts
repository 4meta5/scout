/**
 * Validate command - Validate repos meet structural and modernity criteria.
 * @module commands/validate
 *
 * Outputs:
 * - validate.json per repo: Detailed validation results
 * - validate-summary.json: Summary of all validations
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../config.js'
import { validateStructure } from '../validation/structural.js'
import { checkModernity, computeModernityScore } from '../validation/modernity.js'
import { computeTier2Score } from '../validation/scoring.js'
import {
  CloneManifestSchema,
  ComponentTargetsSchema,
  ValidationSummarySchema,
  type CloneManifest,
  type ComponentTarget,
  type ValidationResult,
  type ValidationSummary,
  type EntrypointCandidate,
} from '../schemas/index.js'

export interface ValidateFlags {
  in?: string
  targets?: string
  out?: string
}

/**
 * Generates entrypoint candidates from matched targets.
 */
function generateEntrypointCandidates(
  matchedTargets: ValidationResult['matchedTargets']
): EntrypointCandidate[] {
  const candidates: EntrypointCandidate[] = []

  for (const target of matchedTargets) {
    const paths: string[] = []

    // Add common entrypoints based on focus roots
    for (const root of target.focusRoots) {
      if (root === '.') {
        paths.push('README.md', 'SKILL.md', 'index.ts', 'src/index.ts')
      } else if (root === 'src') {
        paths.push('src/index.ts', 'src/main.ts', 'src/server.ts', 'src/cli.ts')
      } else if (root === 'src/cli') {
        paths.push('src/cli/index.ts', 'src/cli/app.ts', 'src/cli/main.ts')
      } else if (root.includes('skill')) {
        paths.push(`${root}/SKILL.md`, `${root}/index.ts`)
      } else if (root.includes('hook')) {
        paths.push(`${root}/index.ts`, `${root}/hook.ts`)
      } else if (root.includes('plugin')) {
        paths.push(`${root}/index.ts`, `${root}/plugin.ts`)
      } else {
        paths.push(`${root}/index.ts`, `${root}/main.ts`)
      }
    }

    // Dedupe
    const uniquePaths = [...new Set(paths)]

    candidates.push({
      kind: target.kind,
      paths: uniquePaths.slice(0, 5),
    })
  }

  return candidates
}

export async function runValidate(flags: ValidateFlags): Promise<void> {
  const outputDir = resolve(flags.out ?? join(process.cwd(), '.scout'))
  const runId = randomUUID().slice(0, 8)

  console.log(`🔬 Validating repositories...`)

  // Load configuration
  const config = await loadConfig(process.cwd())

  // Load clone manifest
  const manifestPath = flags.in ?? join(outputDir, 'clone-manifest.json')
  let manifest: CloneManifest

  try {
    const content = await readFile(manifestPath, 'utf-8')
    manifest = CloneManifestSchema.parse(JSON.parse(content))
    console.log(`  → Loaded ${manifest.entries.length} cloned repos from ${manifestPath}`)
  } catch {
    console.error(`❌ Error: Could not load clone manifest from ${manifestPath}`)
    console.error('   Run "scout clone" first')
    process.exit(1)
  }

  // Optionally load targets for comparison
  let projectTargets: ComponentTarget[] = []
  const targetsPath = flags.targets ?? join(outputDir, 'targets.json')
  try {
    const content = await readFile(targetsPath, 'utf-8')
    projectTargets = ComponentTargetsSchema.parse(JSON.parse(content))
    console.log(`  → Loaded ${projectTargets.length} project targets for comparison`)
  } catch {
    // Not required
  }

  const projectKinds = new Set(projectTargets.map((t) => t.kind))

  // Validate each repo
  const results: ValidationResult[] = []

  for (const entry of manifest.entries) {
    console.log(`  → ${entry.repo}`)

    // Structural validation
    const matchedTargets = await validateStructure(entry.localPath)

    // Modernity checks
    const modernitySignals = await checkModernity(entry.localPath)
    const modernityScore = computeModernityScore(modernitySignals)

    // Count structural matches
    const structuralMatchCount = matchedTargets.length

    // Filter to kinds that match project targets (if available)
    const relevantMatches = projectKinds.size > 0
      ? matchedTargets.filter((m) => projectKinds.has(m.kind))
      : matchedTargets

    // Compute tier2 score
    const tier2Score = computeTier2Score(
      entry.tier1Score,
      relevantMatches.length,
      modernityScore,
      config
    )

    // Generate entrypoint candidates
    const entrypointCandidates = generateEntrypointCandidates(matchedTargets)

    const result: ValidationResult = {
      repo: entry.repo,
      localPath: entry.localPath,
      matchedTargets,
      modernitySignals,
      structuralMatchCount,
      modernityScore,
      tier1Score: entry.tier1Score,
      tier2Score,
      entrypointCandidates,
    }

    results.push(result)

    // Show summary
    const matchedKinds = matchedTargets.map((m) => m.kind).join(', ')
    const modernityPct = Math.round(modernityScore * 100)
    const tier2Pct = Math.round(tier2Score * 100)
    console.log(`    Matches: ${matchedKinds || 'none'}`)
    console.log(`    Modernity: ${modernityPct}% | Tier2: ${tier2Pct}%`)
  }

  // Sort by tier2 score descending
  results.sort((a, b) => b.tier2Score - a.tier2Score)

  // Build summary
  const summary: ValidationSummary = {
    timestamp: new Date().toISOString(),
    runId,
    totalValidated: results.length,
    reposWithMatches: results.filter((r) => r.structuralMatchCount > 0).length,
    results,
  }

  // Validate and write
  const validated = ValidationSummarySchema.parse(summary)
  await mkdir(outputDir, { recursive: true })
  const summaryPath = join(outputDir, 'validate-summary.json')
  await writeFile(summaryPath, JSON.stringify(validated, null, 2))

  console.log('')
  console.log(`✅ Validation complete. ${summary.reposWithMatches}/${summary.totalValidated} repos have matches`)
  console.log(`   Summary: ${summaryPath}`)

  // Show rankings
  console.log('')
  console.log('Rankings by Tier2 Score:')
  for (const r of results.slice(0, 5)) {
    const tier2Pct = Math.round(r.tier2Score * 100)
    const kinds = r.matchedTargets.map((m) => m.kind).join(', ')
    console.log(`  ${r.repo} (${tier2Pct}%) - ${kinds || 'library'}`)
  }

  console.log('')
  console.log(`   Next: scout focus --validated ${summaryPath}`)
}
