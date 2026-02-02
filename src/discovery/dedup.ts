/**
 * Deduplication utilities for discovery.
 * @module discovery/dedup
 */

import type { CandidateRepoTier1 } from '../schemas/index.js'

interface RawCandidate {
  repo: string
  url: string
  stars: number
  forks: number
  pushedAt: string
  licenseSpdx: string | null
  description: string | null
  topics: string[]
  laneName: string
}

/**
 * Deduplicates candidates by repo name, merging lane hits.
 */
export function deduplicateCandidates(
  candidates: RawCandidate[]
): Map<string, Omit<CandidateRepoTier1, 'tier1Score'>> {
  const byRepo = new Map<string, Omit<CandidateRepoTier1, 'tier1Score'>>()

  for (const candidate of candidates) {
    const existing = byRepo.get(candidate.repo)

    if (existing) {
      // Merge lane hits
      if (!existing.laneHits.includes(candidate.laneName)) {
        existing.laneHits.push(candidate.laneName)
      }
    } else {
      byRepo.set(candidate.repo, {
        repo: candidate.repo,
        url: candidate.url,
        stars: candidate.stars,
        forks: candidate.forks,
        pushedAt: candidate.pushedAt,
        licenseSpdx: candidate.licenseSpdx,
        description: candidate.description,
        topics: candidate.topics,
        laneHits: [candidate.laneName],
      })
    }
  }

  return byRepo
}
