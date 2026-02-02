/**
 * Search lane builders for GitHub discovery.
 * @module discovery/lanes
 */

import type { ComponentTarget } from '../schemas/index.js'

export interface SearchLane {
  name: string
  query: string
}

/**
 * Builds search lanes from component targets.
 * Each lane represents a different search strategy.
 */
export function buildSearchLanes(targets: ComponentTarget[], primaryLanguage?: string): SearchLane[] {
  const lanes: SearchLane[] = []

  // Collect all unique keywords and topics from targets
  const allKeywords = new Set<string>()
  const allTopics = new Set<string>()

  for (const target of targets) {
    for (const kw of target.searchHints.keywords) {
      allKeywords.add(kw)
    }
    for (const topic of target.searchHints.topics) {
      allTopics.add(topic)
    }
  }

  // Lane A: Language + keywords
  const language = primaryLanguage ?? targets[0]?.searchHints.languageBias ?? 'TypeScript'
  const keywordsList = Array.from(allKeywords).slice(0, 3)
  if (keywordsList.length > 0) {
    const keywordQuery = keywordsList.join(' OR ')
    lanes.push({
      name: 'language-keywords',
      query: `language:${language} (${keywordQuery}) in:name,description,readme`,
    })
  }

  // Lane B: Topics
  const topicsList = Array.from(allTopics).slice(0, 3)
  for (const topic of topicsList) {
    lanes.push({
      name: `topic-${topic}`,
      query: `topic:${topic}`,
    })
  }

  // Lane C: Specific target-kind queries
  for (const target of targets.slice(0, 3)) {
    // Target-specific lanes
    if (target.kind === 'mcp-server') {
      lanes.push({
        name: 'mcp-dependency',
        query: 'modelcontextprotocol in:file filename:package.json',
      })
    } else if (target.kind === 'cli') {
      lanes.push({
        name: 'cli-bin',
        query: `language:${language} "bin" in:file filename:package.json CLI`,
      })
    } else if (target.kind === 'skill') {
      lanes.push({
        name: 'skill-marker',
        query: 'SKILL.md in:path',
      })
    }
  }

  // Dedupe lanes by query
  const seen = new Set<string>()
  return lanes.filter((lane) => {
    if (seen.has(lane.query)) return false
    seen.add(lane.query)
    return true
  })
}

/**
 * Augments search query with quality filters.
 */
export function augmentQuery(baseQuery: string, opts: {
  minStars?: number
  pushedAfter?: string
  notFork?: boolean
  notArchived?: boolean
}): string {
  const parts = [baseQuery]

  if (opts.minStars && opts.minStars > 0) {
    parts.push(`stars:>=${opts.minStars}`)
  }

  if (opts.pushedAfter) {
    parts.push(`pushed:>${opts.pushedAfter}`)
  }

  if (opts.notFork) {
    parts.push('fork:false')
  }

  if (opts.notArchived) {
    parts.push('archived:false')
  }

  return parts.join(' ')
}
