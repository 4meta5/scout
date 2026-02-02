import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm, mkdir } from 'node:fs/promises'

const testDbDir = join(tmpdir(), 'scout-watch-v2-schema-' + Date.now())

vi.mock('../../src/cache.js', () => ({
  getCachePath: (type: string) => join(testDbDir, type),
}))

const { getDb, closeDb } = await import('../../src/watch/db.js')

describe('watch/db v2 schema', () => {
  beforeEach(async () => {
    await rm(testDbDir, { recursive: true, force: true })
    await mkdir(testDbDir, { recursive: true })
  })

  afterEach(async () => {
    closeDb()
    await rm(testDbDir, { recursive: true, force: true })
  })

  it('creates v2 tables for watch state tracking', async () => {
    const db = await getDb()
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `).all() as Array<{ name: string }>

    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('repos')
    expect(tableNames).toContain('tracked')
    expect(tableNames).toContain('snapshots')
    expect(tableNames).toContain('changes')
    expect(tableNames).toContain('sessions')
  })
})
