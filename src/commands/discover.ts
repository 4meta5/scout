/**
 * Discover command - Find similar OSS projects using GitHub search.
 * @module commands/discover
 *
 * Outputs:
 * - candidates.tier1.json: Discovered and scored candidates
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Octokit } from '@octokit/rest'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../config.js'
import { buildSearchLanes, augmentQuery } from '../discovery/lanes.js'
import { getCached, setCached } from '../discovery/cache.js'
import { computeTier1Score, isLicenseAllowed, shouldExclude, isTooOld } from '../discovery/scoring.js'
import { deduplicateCandidates } from '../discovery/dedup.js'
import {
  CandidatesTier1Schema,
  ComponentTargetsSchema,
  type ComponentTarget,
  type CandidateRepoTier1,
  type CandidatesTier1,
} from '../schemas/index.js'

export interface DiscoverFlags {
  root?: string
  targets?: string
  out?: string
}

interface GitHubSearchItem {
  full_name: string
  html_url: string
  stargazers_count: number
  forks_count: number
  pushed_at: string
  license?: { spdx_id?: string } | null
  description: string | null
  topics?: string[]
  archived?: boolean
  fork?: boolean
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runDiscover(flags: DiscoverFlags): Promise<void> {
  const projectRoot = resolve(flags.root ?? process.cwd())
  const outputDir = resolve(flags.out ?? join(projectRoot, '.scout'))
  const runId = randomUUID().slice(0, 8)

  console.log(`🔎 Discovering similar projects...`)

  // Load configuration
  const config = await loadConfig(projectRoot)

  // Check for GitHub token
  if (!config.github.token) {
    console.error('❌ Error: GITHUB_TOKEN environment variable not set')
    console.error('   Set it with: export GITHUB_TOKEN=your_token')
    process.exit(1)
  }

  // Load targets
  let targets: ComponentTarget[]
  const targetsPath = flags.targets ?? join(outputDir, 'targets.json')

  try {
    const content = await readFile(targetsPath, 'utf-8')
    targets = ComponentTargetsSchema.parse(JSON.parse(content))
    console.log(`  → Loaded ${targets.length} targets from ${targetsPath}`)
  } catch {
    console.error(`❌ Error: Could not load targets from ${targetsPath}`)
    console.error('   Run "scout scan" first to generate targets')
    process.exit(1)
  }

  // Build search lanes
  const lanes = buildSearchLanes(targets)
  console.log(`  → Built ${lanes.length} search lanes`)

  // Initialize Octokit
  const octokit = new Octokit({ auth: config.github.token })

  // Execute searches
  const allCandidates: Array<{
    repo: string
    url: string
    stars: number
    forks: number
    pushedAt: string
    licenseSpdx: string | null
    description: string | null
    topics: string[]
    laneName: string
  }> = []

  let queriesExecuted = 0
  const { caching, discovery, rateLimit } = config

  // Calculate pushed_after date
  const pushedAfter = new Date()
  pushedAfter.setDate(pushedAfter.getDate() - discovery.recencyWindowDays)
  // split('T') always returns at least one element from ISO string
  const pushedAfterStr = pushedAfter.toISOString().split('T')[0] as string

  for (const lane of lanes) {
    console.log(`  → Searching lane: ${lane.name}`)

    // Augment query with filters
    const fullQuery = augmentQuery(lane.query, {
      minStars: 5,
      pushedAfter: pushedAfterStr,
      notFork: true,
      notArchived: true,
    })

    // Check cache
    const cacheKey = `search:${fullQuery}`
    const cached = await getCached<GitHubSearchItem[]>(cacheKey)

    let items: GitHubSearchItem[]

    if (cached) {
      console.log(`    (cached)`)
      items = cached
    } else {
      // Execute search with pagination
      items = []

      for (let page = 1; page <= caching.maxPagesPerLane; page++) {
        try {
          // Rate limiting
          if (queriesExecuted > 0) {
            const delayMs = Math.min(
              rateLimit.backoffBaseMs * Math.pow(2, Math.floor(queriesExecuted / 10)),
              rateLimit.backoffMaxMs
            )
            await sleep(delayMs)
          }

          const response = await octokit.search.repos({
            q: fullQuery,
            sort: 'stars',
            order: 'desc',
            per_page: 30,
            page,
          })

          queriesExecuted++
          items.push(...(response.data.items as GitHubSearchItem[]))

          // Stop if we've got enough or no more results
          if (response.data.items.length < 30) break
        } catch (error) {
          if ((error as { status?: number }).status === 403) {
            console.warn(`    ⚠ Rate limited, waiting...`)
            await sleep(rateLimit.backoffMaxMs)
          } else {
            console.warn(`    ⚠ Search error: ${(error as Error).message}`)
          }
          break
        }
      }

      // Cache results
      await setCached(cacheKey, items, caching.ttlHours)
      console.log(`    Found ${items.length} results`)
    }

    // Process items
    for (const item of items) {
      allCandidates.push({
        repo: item.full_name,
        url: item.html_url,
        stars: item.stargazers_count,
        forks: item.forks_count,
        pushedAt: item.pushed_at,
        licenseSpdx: item.license?.spdx_id ?? null,
        description: item.description,
        topics: item.topics ?? [],
        laneName: lane.name,
      })
    }
  }

  console.log(`  → Total raw candidates: ${allCandidates.length}`)

  // Deduplicate
  const deduped = deduplicateCandidates(allCandidates)
  console.log(`  → After dedup: ${deduped.size}`)

  // Filter and score
  const scored: CandidateRepoTier1[] = []

  for (const [, candidate] of deduped) {
    // Early filters
    if (isTooOld(candidate.pushedAt, discovery.recencyWindowDays)) continue
    if (!isLicenseAllowed(candidate.licenseSpdx, discovery.allowLicenses)) continue
    if (shouldExclude(candidate.repo, candidate.description, discovery.excludeKeywords)) continue

    // Score
    const tier1Score = computeTier1Score(
      {
        pushedAt: candidate.pushedAt,
        stars: candidate.stars,
        forks: candidate.forks,
        laneHitsCount: candidate.laneHits.length,
      },
      config
    )

    scored.push({
      ...candidate,
      tier1Score,
    })
  }

  // Sort by tier1 score descending
  scored.sort((a, b) => b.tier1Score - a.tier1Score)

  // Take top candidates
  const topCandidates = scored.slice(0, discovery.maxCandidatesTier1)

  console.log(`  → Scored and filtered: ${scored.length}`)
  console.log(`  → Top candidates: ${topCandidates.length}`)

  // Build output
  const output: CandidatesTier1 = {
    timestamp: new Date().toISOString(),
    runId,
    queriesExecuted,
    totalFound: allCandidates.length,
    candidates: topCandidates,
  }

  // Validate and write
  const validated = CandidatesTier1Schema.parse(output)
  await mkdir(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'candidates.tier1.json')
  await writeFile(outputPath, JSON.stringify(validated, null, 2))

  console.log('')
  console.log(`✅ Discovery complete. Output: ${outputPath}`)

  // Show top 5
  console.log('')
  console.log('Top 5 candidates:')
  for (const c of topCandidates.slice(0, 5)) {
    const score = Math.round(c.tier1Score * 100)
    console.log(`  ${c.repo} (${score}%) ⭐${c.stars}`)
  }

  console.log('')
  console.log(`   Next: scout clone --in ${outputPath}`)
}
