/**
 * Test that experimental commands emit a warning.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('experimental command runtime warning', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('warnExperimental should emit a warning with the command name', async () => {
    const { warnExperimental } = await import('../../src/commands/experimental-warning.js')

    warnExperimental('track')

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[experimental]')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('track')
    )
  })

  it('warnExperimental should only warn once per command', async () => {
    // Clear the module cache to reset the warned state
    vi.resetModules()
    const { warnExperimental } = await import('../../src/commands/experimental-warning.js')

    warnExperimental('watch')
    warnExperimental('watch')
    warnExperimental('watch')

    // Should only warn once
    const watchWarnings = consoleWarnSpy.mock.calls.filter(
      call => typeof call[0] === 'string' && call[0].includes('watch')
    )
    expect(watchWarnings.length).toBe(1)
  })

  it('warnExperimental should warn separately for different commands', async () => {
    vi.resetModules()
    const { warnExperimental } = await import('../../src/commands/experimental-warning.js')

    warnExperimental('track')
    warnExperimental('watch')
    warnExperimental('session')

    expect(consoleWarnSpy).toHaveBeenCalledTimes(3)
  })
})
