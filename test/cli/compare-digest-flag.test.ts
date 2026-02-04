/**
 * Test that compare command has --digest flag.
 */

import { describe, it, expect } from 'vitest'
import { compareCommand } from '../../src/cli/commands.js'

// Stricli structure check
type StricliCommand = { parameters?: { flags?: Record<string, unknown> } }

describe('compare command --digest flag', () => {
  it('compareCommand should have a digest flag', () => {
    const cmd = compareCommand as StricliCommand
    expect(cmd.parameters?.flags?.digest).toBeDefined()
  })

  it('digest flag should be boolean', () => {
    const cmd = compareCommand as StricliCommand
    const digestFlag = cmd.parameters?.flags?.digest as { kind?: string }
    expect(digestFlag?.kind).toBe('boolean')
  })

  it('digest flag should be optional', () => {
    const cmd = compareCommand as StricliCommand
    const digestFlag = cmd.parameters?.flags?.digest as { optional?: boolean }
    expect(digestFlag?.optional).toBe(true)
  })
})
