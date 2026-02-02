import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm, mkdir } from 'node:fs/promises'

// Mock the db module to use a temp directory for lock
const testDbDir = join(tmpdir(), 'scout-lock-test-' + Date.now())

vi.mock('../../src/watch/db.js', () => ({
  getWatchDbDir: () => testDbDir,
}))

// Import after mocking
const {
  acquireWatchLock,
  isWatchLocked,
  withWatchLock,
} = await import('../../src/watch/lock.js')

describe('watch/lock', () => {
  beforeEach(async () => {
    await rm(testDbDir, { recursive: true, force: true })
    await mkdir(testDbDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDbDir, { recursive: true, force: true })
  })

  describe('acquireWatchLock', () => {
    it('acquires and releases a lock', async () => {
      const lock = await acquireWatchLock()
      expect(lock).toBeDefined()
      expect(lock.release).toBeInstanceOf(Function)

      await lock.release()
    })

    it('allows reacquiring after release', async () => {
      const lock1 = await acquireWatchLock()
      await lock1.release()

      const lock2 = await acquireWatchLock()
      await lock2.release()
    })
  })

  describe('isWatchLocked', () => {
    it('returns false when not locked', async () => {
      const locked = await isWatchLocked()
      expect(locked).toBe(false)
    })

    it('returns true when locked', async () => {
      const lock = await acquireWatchLock()

      const locked = await isWatchLocked()
      expect(locked).toBe(true)

      await lock.release()
    })

    it('returns false after release', async () => {
      const lock = await acquireWatchLock()
      await lock.release()

      const locked = await isWatchLocked()
      expect(locked).toBe(false)
    })
  })

  describe('withWatchLock', () => {
    it('executes function with lock held', async () => {
      let executedInLock = false

      await withWatchLock(async () => {
        executedInLock = await isWatchLocked()
      })

      expect(executedInLock).toBe(true)
    })

    it('releases lock after function completes', async () => {
      await withWatchLock(async () => {
        // do nothing
      })

      const locked = await isWatchLocked()
      expect(locked).toBe(false)
    })

    it('releases lock even if function throws', async () => {
      await expect(
        withWatchLock(async () => {
          throw new Error('test error')
        })
      ).rejects.toThrow('test error')

      const locked = await isWatchLocked()
      expect(locked).toBe(false)
    })

    it('returns value from function', async () => {
      const result = await withWatchLock(async () => {
        return 42
      })

      expect(result).toBe(42)
    })
  })
})
