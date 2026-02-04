/**
 * Test that experimental commands have [experimental] prefix in their docs.
 */

import { describe, it, expect } from 'vitest'
import {
  trackCommand,
  watchCommand,
  watchRoutes,
  sessionCommand,
  reviewCommand,
} from '../../src/cli/commands.js'

// Stricli flattens docs.brief to just brief at the top level
type StricliCommand = { brief: string } | { docs: { brief: string } }

function getBrief(cmd: StricliCommand): string {
  if ('brief' in cmd) return cmd.brief
  return cmd.docs.brief
}

describe('experimental command docs', () => {
  it('trackCommand should have [experimental] prefix in brief', () => {
    expect(getBrief(trackCommand as StricliCommand)).toContain('[experimental]')
  })

  it('watchCommand should have [experimental] prefix in brief', () => {
    expect(getBrief(watchCommand as StricliCommand)).toContain('[experimental]')
  })

  it('watchRoutes should have [experimental] prefix in brief', () => {
    expect(getBrief(watchRoutes as StricliCommand)).toContain('[experimental]')
  })

  it('sessionCommand should have [experimental] prefix in brief', () => {
    expect(getBrief(sessionCommand as StricliCommand)).toContain('[experimental]')
  })

  it('reviewCommand should have [experimental] prefix in brief', () => {
    expect(getBrief(reviewCommand as StricliCommand)).toContain('[experimental]')
  })
})
