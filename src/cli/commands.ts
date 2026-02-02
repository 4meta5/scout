/**
 * Scout CLI command definitions
 * All 6 commands with their flags as specified in the plan
 */

import { buildCommand } from '@stricli/core'

/**
 * Scan command - Scan a local project to fingerprint its targets
 * scout scan [--root <path>] [--out <dir>]
 */
export const scanCommand = buildCommand({
  docs: { brief: 'Scan a local project to fingerprint its targets' },
  parameters: {
    flags: {
      root: {
        kind: 'parsed',
        parse: String,
        brief: 'Project root path (defaults to cwd)',
        optional: true,
      },
      out: {
        kind: 'parsed',
        parse: String,
        brief: 'Output directory for scan data',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runScan } = await import('../commands/scan.js')
    await runScan(flags)
  },
})

/**
 * Discover command - Find similar OSS projects using GitHub search
 * scout discover [--root <path>] [--targets <targets.json>] [--out <dir>]
 */
export const discoverCommand = buildCommand({
  docs: { brief: 'Find similar OSS projects using GitHub search' },
  parameters: {
    flags: {
      root: {
        kind: 'parsed',
        parse: String,
        brief: 'Project root path',
        optional: true,
      },
      targets: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to targets.json from scan',
        optional: true,
      },
      out: {
        kind: 'parsed',
        parse: String,
        brief: 'Output directory',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runDiscover } = await import('../commands/discover.js')
    await runDiscover(flags)
  },
})

/**
 * Clone command - Shallow clone discovered repos for analysis
 * scout clone [--in <candidates.tier1.json>] [--top <K>] [--out <dir>]
 */
export const cloneCommand = buildCommand({
  docs: { brief: 'Shallow clone discovered repos for analysis' },
  parameters: {
    flags: {
      in: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to candidates.tier1.json',
        optional: true,
      },
      top: {
        kind: 'parsed',
        parse: Number,
        brief: 'Number of top candidates to clone (default: 5)',
        optional: true,
      },
      out: {
        kind: 'parsed',
        parse: String,
        brief: 'Output directory',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runClone } = await import('../commands/clone.js')
    await runClone(flags)
  },
})

/**
 * Validate command - Validate repos for structural matches and modernity
 * scout validate [--in <clone-manifest.json>] [--targets <targets.json>] [--out <dir>]
 */
export const validateCommand = buildCommand({
  docs: { brief: 'Validate repos for structural matches and modernity' },
  parameters: {
    flags: {
      in: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to clone-manifest.json',
        optional: true,
      },
      targets: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to targets.json for matching',
        optional: true,
      },
      out: {
        kind: 'parsed',
        parse: String,
        brief: 'Output directory',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runValidate } = await import('../commands/validate.js')
    await runValidate(flags)
  },
})

/**
 * Focus command - Generate depth-budgeted context bundles
 * scout focus [--validated <validate-summary.json>] [--out <dir>]
 */
export const focusCommand = buildCommand({
  docs: { brief: 'Generate depth-budgeted context bundles for exploration' },
  parameters: {
    flags: {
      validated: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to validate-summary.json',
        optional: true,
      },
      out: {
        kind: 'parsed',
        parse: String,
        brief: 'Output directory',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runFocus } = await import('../commands/focus.js')
    await runFocus(flags)
  },
})

/**
 * Compare command - Generate comparison report
 * scout compare [--validated <validate-summary.json>] [--focus <focus-index>] [--out <dir>]
 */
export const compareCommand = buildCommand({
  docs: { brief: 'Generate comparison report between target and alternatives' },
  parameters: {
    flags: {
      validated: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to validate-summary.json',
        optional: true,
      },
      focus: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to focus-index.json',
        optional: true,
      },
      out: {
        kind: 'parsed',
        parse: String,
        brief: 'Output directory',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runCompare } = await import('../commands/compare.js')
    await runCompare(flags)
  },
})
