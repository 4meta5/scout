/**
 * Token-budgeted diff chunking for large reviews.
 * @module watch/chunk
 *
 * Splits large diffs into token-budgeted chunks that fit within
 * context window limits for LLM review.
 */

/**
 * Default token budget per chunk.
 */
export const DEFAULT_MAX_TOKENS = 50000

/**
 * Estimates token count from character count.
 * Uses a simple heuristic of 4 characters per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * A chunk of a diff patch.
 */
export interface DiffChunk {
  /** Chunk index (1-based) */
  index: number
  /** Total number of chunks */
  total: number
  /** Chunk content */
  content: string
  /** Files included in this chunk */
  files: string[]
  /** Estimated token count */
  tokens: number
}

/**
 * Result of chunking a diff.
 */
export interface ChunkResult {
  /** List of chunks */
  chunks: DiffChunk[]
  /** Total estimated tokens */
  totalTokens: number
  /** Whether chunking was needed */
  wasChunked: boolean
}

/**
 * Parses a unified diff into file sections.
 */
function parseDiffSections(patch: string): Array<{ header: string; content: string; file: string }> {
  const sections: Array<{ header: string; content: string; file: string }> = []
  const lines = patch.split('\n')

  let currentSection: { header: string; content: string[]; file: string } | null = null

  for (const line of lines) {
    // New file section starts with "diff --git"
    if (line.startsWith('diff --git')) {
      // Save previous section
      if (currentSection !== null) {
        sections.push({
          header: currentSection.header,
          content: currentSection.content.join('\n'),
          file: currentSection.file,
        })
      }

      // Extract file path from "diff --git a/path b/path"
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/)
      const file = match?.[2] ?? 'unknown'

      currentSection = {
        header: line,
        content: [line],
        file,
      }
    } else if (currentSection !== null) {
      currentSection.content.push(line)
    }
  }

  // Save last section
  if (currentSection !== null) {
    sections.push({
      header: currentSection.header,
      content: currentSection.content.join('\n'),
      file: currentSection.file,
    })
  }

  return sections
}

/**
 * Chunks a diff patch by file boundaries to fit within token budget.
 */
export function chunkDiff(
  patch: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  maxFilesPerChunk: number = 20
): ChunkResult {
  const totalTokens = estimateTokens(patch)
  const files = extractFiles(patch)

  // If within budget, no chunking needed
  if (totalTokens <= maxTokens && files.length <= maxFilesPerChunk) {
    return {
      chunks: [{
        index: 1,
        total: 1,
        content: patch,
        files,
        tokens: totalTokens,
      }],
      totalTokens,
      wasChunked: false,
    }
  }

  // Parse into file sections
  const sections = parseDiffSections(patch)

  if (sections.length === 0) {
    return {
      chunks: [{
        index: 1,
        total: 1,
        content: patch,
        files: [],
        tokens: totalTokens,
      }],
      totalTokens,
      wasChunked: false,
    }
  }

  // Pack sections into chunks
  const chunks: Array<{ content: string[]; files: string[]; tokens: number }> = []
  let currentChunk: { content: string[]; files: string[]; tokens: number } = {
    content: [],
    files: [],
    tokens: 0,
  }

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content)

    // If this section alone exceeds budget, it gets its own chunk
    if (sectionTokens > maxTokens) {
      // Finish current chunk if not empty
      if (currentChunk.content.length > 0) {
        chunks.push(currentChunk)
      }

      // Add oversized section as its own chunk (will need truncation or special handling)
      chunks.push({
        content: [section.content],
        files: [section.file],
        tokens: sectionTokens,
      })

      currentChunk = { content: [], files: [], tokens: 0 }
      continue
    }

    const wouldExceedFileLimit = currentChunk.files.length >= maxFilesPerChunk
    const wouldExceedTokenLimit = currentChunk.tokens + sectionTokens > maxTokens

    // If adding this section would exceed budget or file limit, start new chunk
    if (wouldExceedTokenLimit || wouldExceedFileLimit) {
      if (currentChunk.content.length > 0) {
        chunks.push(currentChunk)
      }
      currentChunk = { content: [], files: [], tokens: 0 }
    }

    // Add section to current chunk
    currentChunk.content.push(section.content)
    currentChunk.files.push(section.file)
    currentChunk.tokens += sectionTokens
  }

  // Add final chunk
  if (currentChunk.content.length > 0) {
    chunks.push(currentChunk)
  }

  // Build result
  const total = chunks.length
  return {
    chunks: chunks.map((c, i) => ({
      index: i + 1,
      total,
      content: c.content.join('\n'),
      files: c.files,
      tokens: c.tokens,
    })),
    totalTokens,
    wasChunked: total > 1,
  }
}

/**
 * Extracts file paths from a diff patch.
 */
function extractFiles(patch: string): string[] {
  const files: string[] = []
  const lines = patch.split('\n')

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/)
      const file = match?.[2]
      if (file !== undefined) {
        files.push(file)
      }
    }
  }

  return files
}

/**
 * Generates a chunk filename.
 */
export function getChunkFilename(index: number, total: number): string {
  void total
  const suffix = String(index).padStart(3, '0')
  return `diff.${suffix}.patch`
}

/**
 * Generates a chunk header comment to include in each chunk.
 */
export function generateChunkHeader(chunk: DiffChunk): string {
  const lines = [
    `# Diff Chunk ${chunk.index} of ${chunk.total}`,
    `# Estimated tokens: ${chunk.tokens}`,
    `# Files in this chunk:`,
    ...chunk.files.map(f => `#   - ${f}`),
    '',
  ]
  return lines.join('\n')
}

/**
 * Summarizes chunking for the review context.
 */
export function summarizeChunking(result: ChunkResult): string {
  if (!result.wasChunked) {
    return `Single diff file (${result.totalTokens} tokens)`
  }

  const lines = [
    `Diff split into ${result.chunks.length} chunks (${result.totalTokens} total tokens):`,
  ]

  for (const chunk of result.chunks) {
    lines.push(`  - Chunk ${chunk.index}: ${chunk.files.length} files, ${chunk.tokens} tokens`)
  }

  return lines.join('\n')
}
