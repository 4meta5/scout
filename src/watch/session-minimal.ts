/**
 * Minimal session generator for watch run-once.
 * @module watch/session-minimal
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getCachePath } from '../cache.js'

export interface MinimalSessionInput {
  repo: string
  url: string
  oldSha: string
  newSha: string
  targetKind: string
  trackedPaths: string[]
}

export interface MinimalSessionResult {
  sessionPath: string
}

export async function createMinimalSession(input: MinimalSessionInput): Promise<MinimalSessionResult> {
  const safeRepo = input.repo.replace('/', '_')
  const date = new Date().toISOString().slice(0, 10)
  const shaRange = `${input.oldSha.slice(0, 7)}_${input.newSha.slice(0, 7)}`
  const basePath = join(getCachePath('runs'), 'reviews')
  const sessionPath = join(basePath, safeRepo, date, input.targetKind, shaRange)

  await mkdir(join(sessionPath, 'OUTPUT'), { recursive: true })

  const context = {
    repo: input.repo,
    url: input.url,
    oldSha: input.oldSha,
    newSha: input.newSha,
    targetKind: input.targetKind,
    trackedPaths: input.trackedPaths.map(path => ({ kind: input.targetKind, path })),
    hasDrift: false,
    chunkCount: 1,
    estimatedTokens: 0,
    skillName: 'trailofbits/differential-review',
    skillCommit: 'UNKNOWN',
    createdAt: new Date().toISOString(),
  }

  await writeFile(join(sessionPath, 'review_context.json'), JSON.stringify(context, null, 2))
  await writeFile(join(sessionPath, 'diff.patch'), '')
  await writeFile(join(sessionPath, 'REVIEW_INSTRUCTIONS.md'), [
    '# Differential Security Review',
    '',
    'Review the changes in `diff.patch`.',
    'Write your report to `./OUTPUT/DIFFERENTIAL_REVIEW_REPORT.md`.',
  ].join('\n'))

  return { sessionPath }
}
