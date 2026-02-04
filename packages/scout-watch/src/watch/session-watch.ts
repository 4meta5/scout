/**
 * Watch session generator for run-once workflow.
 * @module watch/session-watch
 */

import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  getCachePath,
  getRepoCachePath,
  shallowClone,
  normalizeGitUrl,
} from '@4meta5/scout'
import { createWorktree, removeWorktree, updateShallowClone } from './fetch.js'
import { generateDiff, getExcludePatterns } from './diff.js'
import { detectDrift } from './drift.js'
import { chunkDiff, getChunkFilename, DEFAULT_MAX_TOKENS, type DiffChunk } from './chunk.js'
import type { ComponentKind } from '@4meta5/scout'

export interface WatchSessionInput {
  repoFullName: string
  repoUrl: string
  oldSha: string
  newSha: string
  targetKind: string
  trackedPaths: string[]
  maxTokens?: number | undefined
  maxFilesPerChunk?: number | undefined
  excludePatterns?: string[] | undefined
  skillName?: string | undefined
  skillCommit?: string | undefined
}

export interface WatchSessionResult {
  sessionPath: string
  driftFlag: boolean
  diffStats: { filesChanged: number; insertions: number; deletions: number }
}

function generateSessionPath(
  repo: string,
  targetKind: string,
  oldSha: string,
  newSha: string
): string {
  const basePath = join(getCachePath('runs'), 'reviews')
  const safeRepo = repo.replace('/', '_')
  const date = new Date().toISOString().slice(0, 10)
  const shaRange = `${oldSha.slice(0, 7)}_${newSha.slice(0, 7)}`
  return join(basePath, safeRepo, date, targetKind, shaRange)
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

export async function createWatchSession(input: WatchSessionInput): Promise<WatchSessionResult> {
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS
  const maxFilesPerChunk = input.maxFilesPerChunk ?? 20
  const skillName = input.skillName ?? 'trailofbits/differential-review'
  const skillCommit = input.skillCommit ?? 'UNKNOWN'

  const [owner, repo] = input.repoFullName.split('/')
  if (owner === undefined || repo === undefined) {
    throw new Error(`Invalid repo name: ${input.repoFullName}`)
  }

  const repoPath = getRepoCachePath(owner, repo)
  const repoUrl = normalizeGitUrl(input.repoUrl)

  await shallowClone(repoUrl, repoPath, 1)
  await updateShallowClone(repoPath)

  const sessionPath = generateSessionPath(input.repoFullName, input.targetKind, input.oldSha, input.newSha)
  const repoDir = join(sessionPath, 'repo')
  const outputDir = join(sessionPath, 'OUTPUT')

  await mkdir(outputDir, { recursive: true })

  try {
    await createWorktree(repoPath, repoDir, input.newSha)
  } catch (error) {
    await rm(sessionPath, { recursive: true, force: true })
    throw new Error(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const excludePatterns = await getExcludePatterns(repoPath, input.excludePatterns ?? [])
  let diff = await generateDiff({
    repoPath,
    oldSha: input.oldSha,
    newSha: input.newSha,
    scopePaths: input.trackedPaths,
    excludePatterns,
  })

  let scopedDrift = false
  let scopedDriftSummary = ''

  if (diff.isEmpty && input.trackedPaths.length > 0) {
    const overallDiff = await generateDiff({
      repoPath,
      oldSha: input.oldSha,
      newSha: input.newSha,
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
    await removeWorktree(repoPath, repoDir)
    await rm(sessionPath, { recursive: true, force: true })
    throw new Error(`No changes in scope for ${input.repoFullName}.`)
  }

  const driftResult = await detectDrift(
    repoPath,
    input.oldSha,
    input.newSha,
    input.trackedPaths.map(path => ({ kind: input.targetKind as ComponentKind, path }))
  )
  const hasDrift = driftResult.hasDrift || scopedDrift
  const driftSummary = driftResult.hasDrift ? driftResult.summary : scopedDriftSummary

  const chunkResult = chunkDiff(diff.patch, maxTokens, maxFilesPerChunk)

  if (chunkResult.wasChunked) {
    const chunksDir = join(sessionPath, 'chunks')
    await mkdir(chunksDir, { recursive: true })

    for (const chunk of chunkResult.chunks) {
      const filename = getChunkFilename(chunk.index, chunk.total)
      await writeFile(join(chunksDir, filename), chunk.content)
    }

    await writeFile(join(sessionPath, 'CHUNK_INDEX.md'), generateChunkIndex(chunkResult.chunks))
  } else {
    await writeFile(join(sessionPath, 'diff.patch'), diff.patch)
  }

  if (hasDrift) {
    await writeFile(join(sessionPath, 'DRIFT.md'), driftSummary)
  }

  const context = {
    repo: input.repoFullName,
    url: input.repoUrl,
    oldSha: input.oldSha,
    newSha: input.newSha,
    targetKind: input.targetKind,
    trackedPaths: input.trackedPaths.map(path => ({ kind: input.targetKind, path })),
    hasDrift,
    chunkCount: chunkResult.chunks.length,
    estimatedTokens: chunkResult.totalTokens,
    skillName,
    skillCommit,
    createdAt: new Date().toISOString(),
  }

  await writeFile(join(sessionPath, 'review_context.json'), JSON.stringify(context, null, 2))
  await writeFile(join(sessionPath, 'REVIEW_INSTRUCTIONS.md'), [
    '# Differential Security Review',
    '',
    `- **Repository**: ${context.repo}`,
    `- **URL**: ${context.url}`,
    `- **Old SHA**: ${context.oldSha}`,
    `- **New SHA**: ${context.newSha}`,
    `- **Skill**: ${context.skillName}@${context.skillCommit}`,
    '',
    chunkResult.wasChunked ? 'Review the changes in `chunks/`.' : 'Review the changes in `diff.patch`.',
    'Write your report to `./OUTPUT/DIFFERENTIAL_REVIEW_REPORT.md`.',
  ].join('\n'))

  return {
    sessionPath,
    driftFlag: hasDrift,
    diffStats: {
      filesChanged: diff.filesChanged,
      insertions: diff.insertions,
      deletions: diff.deletions,
    },
  }
}
