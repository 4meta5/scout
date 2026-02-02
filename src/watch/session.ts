/**
 * Session directory generation for differential security review.
 * @module watch/session
 *
 * Generates a complete review session directory containing:
 * - Git worktree at new SHA
 * - Hygienic diff (or chunks)
 * - Review context JSON
 * - REVIEW_INSTRUCTIONS.md for the review agent
 * - DRIFT.md if path drift was detected
 * - OUTPUT directory for review results
 */

import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { getCachePath } from '../cache.js'
import {
  getTrackedRepoByName,
  getTrackedPathsByRepoId,
  insertReviewSession,
  getExistingReviewSession,
} from './db.js'
import { createWorktree, removeWorktree } from './fetch.js'
import { generateDiff, getExcludePatterns } from './diff.js'
import { detectDrift } from './drift.js'
import { chunkDiff, getChunkFilename, DEFAULT_MAX_TOKENS, type DiffChunk } from './chunk.js'
import type { ReviewContext } from '../schemas/watch.js'
import type { ComponentKind } from '../schemas/targets.js'

/**
 * Options for generating a review session.
 */
export interface SessionOptions {
  /** Full repo name (owner/repo) */
  repo: string
  /** Target component kind for scoped review (optional) */
  targetKind?: ComponentKind | undefined
  /** Maximum tokens per chunk */
  maxTokens?: number | undefined
  /** Custom output directory */
  outputDir?: string | undefined
  /** Differential-review skill name */
  skillName?: string | undefined
  /** Differential-review skill commit */
  skillCommit?: string | undefined
}

/**
 * Result of generating a review session.
 */
export interface SessionResult {
  /** Path to the generated session directory */
  sessionPath: string
  /** Database ID of the session */
  sessionId: number
  /** Old SHA (baseline) */
  oldSha: string
  /** New SHA (target) */
  newSha: string
  /** Number of diff chunks */
  chunkCount: number
  /** Whether drift was detected */
  hasDrift: boolean
  /** Total estimated tokens */
  estimatedTokens: number
  /** Whether this is a new session or existing */
  isNew: boolean
}

/**
 * Generates the base path for review sessions.
 */
export function getReviewsBasePath(): string {
  return join(getCachePath('runs'), 'reviews')
}

/**
 * Generates a session directory path.
 */
export function generateSessionPath(
  repo: string,
  targetKind: ComponentKind | null,
  oldSha: string,
  newSha: string
): string {
  const basePath = getReviewsBasePath()
  const safeRepo = repo.replace('/', '_')
  const date = new Date().toISOString().slice(0, 10)
  const kindDir = targetKind ?? 'all'
  const shaRange = `${oldSha.slice(0, 7)}_${newSha.slice(0, 7)}`

  return join(basePath, safeRepo, date, kindDir, shaRange)
}

/**
 * Generates REVIEW_INSTRUCTIONS.md content aligned with Trail of Bits differential-review skill.
 */
function generateReviewInstructions(context: ReviewContext, chunkCount: number): string {
  const lines: string[] = [
    '# Differential Security Review',
    '',
    '## Context',
    '',
    `- **Repository**: ${context.repo}`,
    `- **URL**: ${context.url}`,
    `- **Old SHA**: ${context.oldSha}`,
    `- **New SHA**: ${context.newSha}`,
    context.targetKind !== null ? `- **Focus**: ${context.targetKind} components` : '',
    `- **Estimated tokens**: ${context.estimatedTokens}`,
    `- **Skill**: ${context.skillName}@${context.skillCommit}`,
    '',
  ].filter(Boolean)

  if (context.hasDrift) {
    lines.push(
      '## ⚠️ Drift Warning',
      '',
      'Tracked paths have moved, renamed, or been deleted.',
      'See `DRIFT.md` for details.',
      ''
    )
  }

  const additionalLines = [
    '## Review Scope',
    '',
    chunkCount === 1
      ? 'Review the changes in `diff.patch`.'
      : `Review the changes across ${chunkCount} chunks in the \`chunks/\` directory.`,
    '',
    '## Instructions',
    '',
    '1. **Understand the context**: Use `./repo/` for git blame, git log, and browsing the codebase at the new SHA.',
    '',
    '2. **Review the diff**: Focus on security-relevant changes:',
    '   - Authentication and authorization logic',
    '   - Input validation and sanitization',
    '   - Cryptographic operations',
    '   - External API calls and data handling',
    '   - Error handling and information disclosure',
    '   - Dependency changes',
    '',
    '3. **Risk-first analysis**: Prioritize findings by:',
    '   - **Critical**: Immediate security vulnerabilities',
    '   - **High**: Security weaknesses exploitable with effort',
    '   - **Medium**: Defense-in-depth issues',
    '   - **Low**: Best practice deviations',
    '',
    '4. **Write findings**: Create `./OUTPUT/DIFFERENTIAL_REVIEW_REPORT.md` with:',
    '   - Executive summary',
    '   - Findings table (severity, file, description)',
    '   - Detailed analysis per finding',
    '   - Recommendations',
    '',
    '## Files',
    '',
    '| File | Description |',
    '|------|-------------|',
    '| `repo/` | Git worktree at new SHA |',
    chunkCount === 1 ? '| `diff.patch` | Hygienic diff |' : '| `chunks/` | Diff chunks |',
    '| `review_context.json` | Machine-readable context |',
    context.hasDrift ? '| `DRIFT.md` | Path drift details |' : '',
    '| `OUTPUT/` | Write review report here |',
    '',
  ].filter(Boolean)

  lines.push(...additionalLines)

  if (context.trackedPaths.length > 0) {
    lines.push(
      '## Tracked Paths',
      '',
      'Pay special attention to changes in these areas:',
      ''
    )
    for (const p of context.trackedPaths) {
      lines.push(`- \`${p.path}\` (${p.kind})`)
    }
    lines.push('')
  }

  lines.push(
    '## Output',
    '',
    'Write your security review to:',
    '',
    '```',
    './OUTPUT/DIFFERENTIAL_REVIEW_REPORT.md',
    '```',
  )

  return lines.join('\n')
}

function generateChunkIndex(chunks: DiffChunk[]): string {
  const lines: string[] = [
    '# Diff Chunk Index',
    '',
    'Each chunk file contains a subset of the diff for review.',
    '',
  ]

  for (const chunk of chunks) {
    const filename = getChunkFilename(chunk.index, chunk.total)
    lines.push(`- ${filename}`)
    for (const file of chunk.files) {
      lines.push(`  - ${file}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generates a review session directory.
 */
export async function generateSession(options: SessionOptions): Promise<SessionResult> {
  const {
    repo,
    targetKind,
    maxTokens = DEFAULT_MAX_TOKENS,
    skillName = 'trailofbits/differential-review',
    skillCommit = 'UNKNOWN',
  } = options

  // Get tracked repo
  const tracked = await getTrackedRepoByName(repo)
  if (tracked === null) {
    throw new Error(`Repo "${repo}" is not tracked. Run "scout track" first.`)
  }

  // Determine SHAs
  const oldSha = tracked.baselineSha
  const newSha = tracked.lastSha ?? tracked.baselineSha

  if (oldSha === newSha) {
    throw new Error(`No changes detected for ${repo}. Run "scout watch" first.`)
  }

  // Check for existing session
  const existing = await getExistingReviewSession(
    tracked.id,
    oldSha,
    newSha,
    targetKind ?? null
  )

  if (existing !== null) {
    return {
      sessionPath: existing.sessionPath,
      sessionId: existing.id,
      oldSha,
      newSha,
      chunkCount: existing.chunkCount,
      hasDrift: false, // Already exists
      estimatedTokens: 0,
      isNew: false,
    }
  }

  // Get tracked paths
  const trackedPaths = await getTrackedPathsByRepoId(tracked.id)

  // Filter by target kind if specified
  const relevantPaths = targetKind !== undefined
    ? trackedPaths.filter(p => p.kind === targetKind)
    : trackedPaths

  // Generate session path
  const sessionPath = options.outputDir ?? generateSessionPath(
    repo,
    targetKind ?? null,
    oldSha,
    newSha
  )

  // Create directories
  const repoDir = join(sessionPath, 'repo')
  const outputDir = join(sessionPath, 'OUTPUT')
  await mkdir(sessionPath, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  // Create git worktree at new SHA
  try {
    await createWorktree(tracked.localPath, repoDir, newSha)
  } catch (error) {
    // Clean up on failure
    await rm(sessionPath, { recursive: true, force: true })
    throw new Error(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Generate scoped diff
  const scopePaths = relevantPaths.length > 0
    ? relevantPaths.map(p => p.path)
    : undefined

  const excludePatterns = await getExcludePatterns(tracked.localPath, [])

  let diff = await generateDiff({
    repoPath: tracked.localPath,
    oldSha,
    newSha,
    scopePaths,
    excludePatterns,
  })

  let scopedDrift = false
  let scopedDriftSummary = ''

  if (diff.isEmpty && scopePaths !== undefined && scopePaths.length > 0) {
    const overallDiff = await generateDiff({
      repoPath: tracked.localPath,
      oldSha,
      newSha,
      excludePatterns,
    })

    if (!overallDiff.isEmpty) {
      scopedDrift = true
      scopedDriftSummary = [
        '# Tracked Path Drift Detected',
        '',
        'The scoped diff was empty, but changes exist elsewhere in the repo.',
        'This likely indicates tracked paths have moved or require re-validation.',
      ].join('\n')
      diff = overallDiff
    }
  }

  if (diff.isEmpty) {
    // Clean up empty session
    await removeWorktree(tracked.localPath, repoDir)
    await rm(sessionPath, { recursive: true, force: true })
    throw new Error(`No changes in scope for ${repo}. Try without --kind filter.`)
  }

  // Detect drift
  const driftResult = await detectDrift(tracked.localPath, oldSha, newSha, relevantPaths)
  const hasDrift = driftResult.hasDrift || scopedDrift
  const driftSummary = driftResult.hasDrift ? driftResult.summary : scopedDriftSummary

  // Chunk diff if needed
  const chunkResult = chunkDiff(diff.patch, maxTokens)

  // Write diff or chunks
  if (chunkResult.wasChunked) {
    const chunksDir = join(sessionPath, 'chunks')
    await mkdir(chunksDir, { recursive: true })

    for (const chunk of chunkResult.chunks) {
      const filename = getChunkFilename(chunk.index, chunk.total)
      await writeFile(join(chunksDir, filename), chunk.content)
    }

    const chunkIndex = generateChunkIndex(chunkResult.chunks)
    await writeFile(join(sessionPath, 'CHUNK_INDEX.md'), chunkIndex)
  } else {
    await writeFile(join(sessionPath, 'diff.patch'), diff.patch)
  }

  // Write drift report if detected
  if (hasDrift) {
    await writeFile(join(sessionPath, 'DRIFT.md'), driftSummary)
  }

  // Build review context
  const context: ReviewContext = {
    repo: tracked.repo,
    url: tracked.url,
    oldSha,
    newSha,
    targetKind: targetKind ?? null,
    trackedPaths: relevantPaths.map(p => ({ kind: p.kind, path: p.path })),
    hasDrift,
    chunkCount: chunkResult.chunks.length,
    estimatedTokens: chunkResult.totalTokens,
    skillName,
    skillCommit,
    createdAt: new Date().toISOString(),
  }

  // Write context JSON
  await writeFile(
    join(sessionPath, 'review_context.json'),
    JSON.stringify(context, null, 2)
  )

  // Write review instructions
  const instructions = generateReviewInstructions(context, chunkResult.chunks.length)
  await writeFile(join(sessionPath, 'REVIEW_INSTRUCTIONS.md'), instructions)

  // Insert session into database
  const sessionId = await insertReviewSession({
    repoId: tracked.id,
    sessionPath,
    oldSha,
    newSha,
    targetKind: targetKind ?? null,
    chunkCount: chunkResult.chunks.length,
  })

  return {
    sessionPath,
    sessionId,
    oldSha,
    newSha,
    chunkCount: chunkResult.chunks.length,
    hasDrift,
    estimatedTokens: chunkResult.totalTokens,
    isNew: true,
  }
}
