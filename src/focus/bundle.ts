/**
 * Focus bundle generation.
 * @module focus/bundle
 */

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type {
  FocusBundle,
  RunHints,
  Provenance,
  ValidationResult,
} from '../schemas/index.js'
import { resolveEntrypoints } from './entrypoints.js'
import { collectScopeFiles, deduplicateScopeRoots } from './scope.js'
import type { ScoutConfig } from '../config.js'

interface PackageJson {
  scripts?: Record<string, string>
  packageManager?: string
}

/**
 * Reads package.json if it exists.
 */
async function readPackageJson(repoPath: string): Promise<PackageJson | null> {
  try {
    const content = await readFile(join(repoPath, 'package.json'), 'utf-8')
    return JSON.parse(content) as PackageJson
  } catch {
    return null
  }
}

/**
 * Detects build tool from package.json.
 */
function detectBuildTool(pkg: PackageJson | null): string | undefined {
  if (!pkg?.packageManager) return undefined

  if (pkg.packageManager.startsWith('pnpm')) return 'pnpm'
  if (pkg.packageManager.startsWith('yarn')) return 'yarn'
  if (pkg.packageManager.startsWith('npm')) return 'npm'

  return undefined
}

/**
 * Generates RUN_HINTS from package.json scripts.
 */
async function generateRunHints(repoPath: string): Promise<RunHints> {
  const pkg = await readPackageJson(repoPath)

  const scripts: Array<{ name: string; command: string }> = []

  if (pkg?.scripts) {
    // Priority scripts
    const priority = ['test', 'build', 'lint', 'dev', 'start', 'typecheck']

    for (const name of priority) {
      if (pkg.scripts[name]) {
        scripts.push({ name, command: pkg.scripts[name] })
      }
    }

    // Add other scripts (limited)
    for (const [name, command] of Object.entries(pkg.scripts)) {
      if (scripts.length >= 10) break
      if (!priority.includes(name)) {
        scripts.push({ name, command })
      }
    }
  }

  return {
    scripts,
    buildTool: detectBuildTool(pkg),
  }
}

/**
 * Generates a focus bundle for a repository.
 */
export async function generateBundle(
  result: ValidationResult,
  config: ScoutConfig
): Promise<FocusBundle> {
  const { focus } = config
  const repoPath = result.localPath

  // Collect all focus roots from matched targets
  const allRoots: string[] = []
  for (const target of result.matchedTargets) {
    allRoots.push(...target.focusRoots)
  }

  // Add default roots if none found
  if (allRoots.length === 0) {
    allRoots.push('src', 'lib', '.')
  }

  // Deduplicate
  const scopeRoots = deduplicateScopeRoots(allRoots)

  // Resolve entrypoints
  const entrypoints = await resolveEntrypoints(
    repoPath,
    result.entrypointCandidates,
    focus.entrypointsPerTarget
  )

  // Collect files
  const files = await collectScopeFiles(
    repoPath,
    scopeRoots,
    focus.maxDirsPerTarget,
    focus.maxFilesPerDir
  )

  return {
    repo: result.repo,
    entrypoints,
    scopeRoots,
    files,
  }
}

/**
 * Generates provenance information for a bundle.
 */
export function generateProvenance(
  result: ValidationResult,
  sha: string,
  license: string | null,
  toolVersion: string,
  runId: string
): Provenance {
  return {
    repo: result.repo,
    url: `https://github.com/${result.repo}`,
    sha,
    license,
    tier1Score: result.tier1Score,
    tier2Score: result.tier2Score,
    toolVersion,
    runId,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Formats a bundle as FOCUS.md markdown.
 */
export function formatFocusMd(bundle: FocusBundle, runHints: RunHints): string {
  const lines: string[] = []

  lines.push(`# Focus: ${bundle.repo}`)
  lines.push('')
  lines.push('## Entrypoints')
  lines.push('')

  for (const ep of bundle.entrypoints) {
    lines.push(`- **${ep.path}** (${ep.kind}): ${ep.reason}`)
  }

  lines.push('')
  lines.push('## Scope Roots')
  lines.push('')

  for (const root of bundle.scopeRoots) {
    lines.push(`- \`${root}/\``)
  }

  lines.push('')
  lines.push('## Files')
  lines.push('')
  lines.push(`Total: ${bundle.files.length} files`)
  lines.push('')

  // Group by directory
  const byDir = new Map<string, typeof bundle.files>()
  for (const file of bundle.files) {
    const dir = dirname(file.path)
    if (!byDir.has(dir)) {
      byDir.set(dir, [])
    }
    // byDir.has(dir) guarantees get() returns array
    byDir.get(dir)?.push(file)
  }

  for (const [dir, files] of byDir) {
    lines.push(`### ${dir}/`)
    for (const file of files.slice(0, 10)) {
      const kb = (file.sizeBytes / 1024).toFixed(1)
      lines.push(`- ${file.path} (${kb} KB)`)
    }
    if (files.length > 10) {
      lines.push(`- ... and ${files.length - 10} more`)
    }
    lines.push('')
  }

  if (runHints.scripts.length > 0) {
    lines.push('## Run Hints')
    lines.push('')
    if (runHints.buildTool) {
      lines.push(`Build tool: \`${runHints.buildTool}\``)
      lines.push('')
    }
    lines.push('| Script | Command |')
    lines.push('|--------|---------|')
    for (const s of runHints.scripts) {
      lines.push(`| ${s.name} | \`${s.command}\` |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Formats provenance as PROVENANCE.md markdown.
 */
export function formatProvenanceMd(provenance: Provenance): string {
  const lines: string[] = []

  lines.push(`# Provenance: ${provenance.repo}`)
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|-------|-------|')
  lines.push(`| Repository | [${provenance.repo}](${provenance.url}) |`)
  lines.push(`| Commit SHA | \`${provenance.sha}\` |`)
  lines.push(`| License | ${provenance.license ?? 'Unknown'} |`)
  lines.push(`| Tier1 Score | ${Math.round(provenance.tier1Score * 100)}% |`)
  lines.push(`| Tier2 Score | ${Math.round(provenance.tier2Score * 100)}% |`)
  lines.push(`| Tool Version | ${provenance.toolVersion} |`)
  lines.push(`| Run ID | ${provenance.runId} |`)
  lines.push(`| Generated | ${provenance.timestamp} |`)
  lines.push('')

  return lines.join('\n')
}

/**
 * Formats run hints as RUN_HINTS.md markdown.
 */
export function formatRunHintsMd(runHints: RunHints, repo: string): string {
  const lines: string[] = []

  lines.push(`# Run Hints: ${repo}`)
  lines.push('')

  if (runHints.buildTool) {
    lines.push(`## Build Tool`)
    lines.push('')
    lines.push(`\`${runHints.buildTool}\``)
    lines.push('')
  }

  if (runHints.scripts.length > 0) {
    lines.push('## Available Scripts')
    lines.push('')
    for (const s of runHints.scripts) {
      lines.push(`### ${s.name}`)
      lines.push('')
      lines.push('```bash')
      lines.push(`${runHints.buildTool ?? 'npm'} run ${s.name}`)
      lines.push('```')
      lines.push('')
      lines.push(`Command: \`${s.command}\``)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export { generateRunHints }
