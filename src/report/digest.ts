/**
 * Compact digest report format for Engram ingestion.
 * @module report/digest
 *
 * Generates a 1-2 page summary suitable for LLM context windows.
 */

import type { CompareReport } from '../schemas/index.js'

/**
 * Formats a comparison report as a compact digest.
 * Target: under 2000 characters for typical reports.
 */
export function formatDigestMd(report: CompareReport): string {
  const lines: string[] = []

  // Header with run info
  lines.push('# Scout Digest')
  lines.push('')

  // Summary in one line
  const { summary } = report
  lines.push(
    `**Pipeline:** ${summary.totalDiscovered} discovered → ${summary.cloned} cloned → ${summary.validated} validated`
  )
  lines.push('')

  // Top recommendation
  if (summary.topRecommendation) {
    const top = report.candidates[0]
    if (top) {
      const score = Math.round(top.tier2Score * 100)
      lines.push(`## Top Match: ${top.repo} (${score}%)`)
      lines.push('')
      if (top.matchedKinds.length > 0) {
        lines.push(`- **Components:** ${top.matchedKinds.join(', ')}`)
      }
      if (top.license) {
        lines.push(`- **License:** ${top.license}`)
      }
      if (top.topEntrypoints.length > 0) {
        lines.push(`- **Entry:** \`${top.topEntrypoints[0]}\``)
      }
      lines.push(`- **Link:** https://github.com/${top.repo}`)
      lines.push('')
    }
  }

  // Ranked alternatives (compact table)
  if (report.candidates.length > 1) {
    lines.push('## Alternatives')
    lines.push('')
    lines.push('| Rank | Repo | Score |')
    lines.push('|------|------|-------|')

    for (const [i, c] of report.candidates.slice(0, 5).entries()) {
      const score = Math.round(c.tier2Score * 100)
      lines.push(`| ${i + 1} | ${c.repo} | ${score}% |`)
    }
    lines.push('')
  }

  // Metadata footer
  lines.push('---')
  lines.push(`*Run: ${report.runId} | ${report.timestamp.slice(0, 10)}*`)
  lines.push('')

  return lines.join('\n')
}

/**
 * Generates compact digest JSON suitable for programmatic use.
 */
export interface DigestJson {
  runId: string
  timestamp: string
  pipeline: {
    discovered: number
    cloned: number
    validated: number
  }
  topMatch: {
    repo: string
    score: number
    components: string[]
    license: string | null
    url: string
  } | null
  alternatives: Array<{
    repo: string
    score: number
  }>
}

/**
 * Converts a comparison report to compact digest JSON.
 */
export function toDigestJson(report: CompareReport): DigestJson {
  const top = report.candidates[0]

  return {
    runId: report.runId,
    timestamp: report.timestamp,
    pipeline: {
      discovered: report.summary.totalDiscovered,
      cloned: report.summary.cloned,
      validated: report.summary.validated,
    },
    topMatch: top
      ? {
          repo: top.repo,
          score: Math.round(top.tier2Score * 100),
          components: top.matchedKinds,
          license: top.license,
          url: `https://github.com/${top.repo}`,
        }
      : null,
    alternatives: report.candidates.slice(1, 5).map((c) => ({
      repo: c.repo,
      score: Math.round(c.tier2Score * 100),
    })),
  }
}
