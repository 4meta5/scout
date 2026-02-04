import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  chunkDiff,
  getChunkFilename,
  generateChunkHeader,
  DEFAULT_MAX_TOKENS,
} from '../../src/watch/chunk.js'

describe('watch/chunk', () => {
  describe('estimateTokens', () => {
    it('estimates 1 token per 4 characters', () => {
      expect(estimateTokens('1234')).toBe(1)
      expect(estimateTokens('12345678')).toBe(2)
      expect(estimateTokens('12345')).toBe(2) // rounds up
    })

    it('handles empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })

  describe('chunkDiff', () => {
    const createDiffSection = (file: string, lines: number): string => {
      const header = `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n`
      const content = Array(lines).fill('+line of content\n').join('')
      return header + content
    }

    it('returns single chunk for small diffs', () => {
      const patch = createDiffSection('small.ts', 10)
      const result = chunkDiff(patch, DEFAULT_MAX_TOKENS)

      expect(result.wasChunked).toBe(false)
      expect(result.chunks).toHaveLength(1)
      expect(result.chunks[0].index).toBe(1)
      expect(result.chunks[0].total).toBe(1)
      expect(result.chunks[0].files).toContain('small.ts')
    })

    it('splits large diffs by file boundaries', () => {
      // Create a diff with multiple files
      const sections = [
        createDiffSection('file1.ts', 500),
        createDiffSection('file2.ts', 500),
        createDiffSection('file3.ts', 500),
      ]
      const patch = sections.join('\n')

      // Use a small token budget to force chunking
      const result = chunkDiff(patch, 2000)

      expect(result.wasChunked).toBe(true)
      expect(result.chunks.length).toBeGreaterThan(1)

      // All files should be represented
      const allFiles = result.chunks.flatMap(c => c.files)
      expect(allFiles).toContain('file1.ts')
      expect(allFiles).toContain('file2.ts')
      expect(allFiles).toContain('file3.ts')
    })

    it('handles empty patch', () => {
      const result = chunkDiff('', 1000)

      expect(result.wasChunked).toBe(false)
      expect(result.chunks).toHaveLength(1)
      expect(result.totalTokens).toBe(0)
    })

    it('assigns correct indices to chunks', () => {
      const sections = [
        createDiffSection('a.ts', 1000),
        createDiffSection('b.ts', 1000),
      ]
      const patch = sections.join('\n')
      const result = chunkDiff(patch, 3000)

      if (result.wasChunked) {
        for (let i = 0; i < result.chunks.length; i++) {
          expect(result.chunks[i].index).toBe(i + 1)
          expect(result.chunks[i].total).toBe(result.chunks.length)
        }
      }
    })

    it('respects maxFilesPerChunk', () => {
      const sections = [
        createDiffSection('a.ts', 10),
        createDiffSection('b.ts', 10),
        createDiffSection('c.ts', 10),
      ]
      const patch = sections.join('\n')
      const result = chunkDiff(patch, DEFAULT_MAX_TOKENS, 1)

      expect(result.wasChunked).toBe(true)
      expect(result.chunks).toHaveLength(3)
    })
  })

  describe('getChunkFilename', () => {
    it('generates correct filename format', () => {
      expect(getChunkFilename(1, 3)).toBe('diff.001.patch')
      expect(getChunkFilename(2, 10)).toBe('diff.002.patch')
    })
  })

  describe('generateChunkHeader', () => {
    it('includes chunk info and files', () => {
      const chunk = {
        index: 2,
        total: 5,
        content: 'diff content',
        files: ['src/a.ts', 'src/b.ts'],
        tokens: 1000,
      }

      const header = generateChunkHeader(chunk)

      expect(header).toContain('Chunk 2 of 5')
      expect(header).toContain('1000')
      expect(header).toContain('src/a.ts')
      expect(header).toContain('src/b.ts')
    })
  })
})
