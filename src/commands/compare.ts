/**
 * Compare command - Generate comparison report between target and OSS alternatives.
 * @module commands/compare
 *
 * Outputs:
 * - REPORT.md: Human-readable comparison report
 * - report.json: Machine-readable comparison data
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  generateReport,
  loadFingerprint,
  loadFocusIndex,
} from '../report/generator.js'
import { formatReportMd, formatTerminalSummary } from '../report/markdown.js'
import { formatDigestMd, toDigestJson } from '../report/digest.js'
import {
  ValidationSummarySchema,
  CandidatesTier1Schema,
  CompareReportSchema,
  type ValidationSummary,
} from '../schemas/index.js'

export interface CompareFlags {
  validated?: string
  focus?: string
  out?: string
  digest?: boolean
}

export async function runCompare(flags: CompareFlags): Promise<void> {
  const outputDir = resolve(flags.out ?? join(process.cwd(), '.scout'))
  const runId = randomUUID().slice(0, 8)

  console.log(`📊 Generating comparison report...`)

  // Load validation summary
  const summaryPath = flags.validated ?? join(outputDir, 'validate-summary.json')
  let validationSummary: ValidationSummary

  try {
    const content = await readFile(summaryPath, 'utf-8')
    validationSummary = ValidationSummarySchema.parse(JSON.parse(content))
    console.log(`  → Loaded ${validationSummary.results.length} validated repos`)
  } catch {
    console.error(`❌ Error: Could not load validation summary from ${summaryPath}`)
    console.error('   Run "scout validate" first')
    process.exit(1)
  }

  // Load discovery data for total count
  let totalDiscovered = 0
  try {
    const discoverPath = join(outputDir, 'candidates.tier1.json')
    const content = await readFile(discoverPath, 'utf-8')
    const candidates = CandidatesTier1Schema.parse(JSON.parse(content))
    totalDiscovered = candidates.totalFound
    console.log(`  → Discovery found ${totalDiscovered} total candidates`)
  } catch {
    // Not critical
  }

  // Load fingerprint
  const fingerprint = await loadFingerprint(outputDir)
  if (fingerprint) {
    console.log(`  → Loaded project fingerprint`)
  }

  // Load focus index if provided
  const focusPath = flags.focus ?? join(outputDir, 'focus-index.json')
  const focusIndex = await loadFocusIndex(focusPath)
  if (focusIndex) {
    console.log(`  → Loaded focus index with ${focusIndex.repos.length} repos`)
  }

  // Generate report
  const report = generateReport(
    validationSummary,
    fingerprint,
    focusIndex,
    totalDiscovered,
    runId
  )

  // Validate report
  const validatedReport = CompareReportSchema.parse(report)
  await mkdir(outputDir, { recursive: true })

  // Digest mode: compact output
  if (flags.digest === true) {
    const digestJsonPath = join(outputDir, 'digest.json')
    await writeFile(digestJsonPath, JSON.stringify(toDigestJson(validatedReport), null, 2))
    console.log(`  → Wrote ${digestJsonPath}`)

    const digestMdPath = join(outputDir, 'DIGEST.md')
    await writeFile(digestMdPath, formatDigestMd(validatedReport))
    console.log(`  → Wrote ${digestMdPath}`)

    // Also write full JSON for reference
    const jsonPath = join(outputDir, 'report.json')
    await writeFile(jsonPath, JSON.stringify(validatedReport, null, 2))
    console.log(`  → Wrote ${jsonPath}`)

    // Print terminal summary
    console.log('')
    console.log(formatTerminalSummary(report))
    console.log('')
    console.log(`✅ Digest complete: ${digestMdPath}`)
    return
  }

  // Full report mode
  const jsonPath = join(outputDir, 'report.json')
  await writeFile(jsonPath, JSON.stringify(validatedReport, null, 2))
  console.log(`  → Wrote ${jsonPath}`)

  // Write REPORT.md
  const mdPath = join(outputDir, 'REPORT.md')
  await writeFile(mdPath, formatReportMd(report))
  console.log(`  → Wrote ${mdPath}`)

  // Print terminal summary
  console.log('')
  console.log(formatTerminalSummary(report))
  console.log('')
  console.log(`✅ Report complete: ${mdPath}`)
}
