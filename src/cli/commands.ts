/**
 * Scout CLI command definitions
 * All 6 commands with their flags as specified in the plan
 */

import { buildCommand, buildRouteMap } from '@stricli/core'

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
 * scout compare [--validated <validate-summary.json>] [--focus <focus-index>] [--out <dir>] [--digest]
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
      digest: {
        kind: 'boolean',
        brief: 'Generate compact digest format (1-2 pages) instead of full report',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runCompare } = await import('../commands/compare.js')
    await runCompare(flags)
  },
})

/**
 * Track command - Add validated repos to watch list
 * scout track [--validated <path>] [--repo owner/name] [--all] [--list]
 */
export const trackCommand = buildCommand({
  docs: { brief: '[experimental] Add validated repos to the watch list for change tracking' },
  parameters: {
    flags: {
      validated: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to validate-summary.json',
        optional: true,
      },
      repo: {
        kind: 'parsed',
        parse: String,
        brief: 'Track a specific repo by name (owner/name)',
        optional: true,
      },
      all: {
        kind: 'boolean',
        brief: 'Track all repos in the validation summary',
        optional: true,
      },
      list: {
        kind: 'boolean',
        brief: 'List currently tracked repos',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runTrack } = await import('../commands/track.js')
    await runTrack(flags)
  },
})

/**
 * Watch command - Fetch updates and detect changes
 * scout watch [--repo owner/name] [--all]
 */
export const watchCommand = buildCommand({
  docs: { brief: '[experimental] Fetch updates for tracked repos and detect changes' },
  parameters: {
    flags: {
      repo: {
        kind: 'parsed',
        parse: String,
        brief: 'Fetch a specific repo by name (owner/name)',
        optional: true,
      },
      all: {
        kind: 'boolean',
        brief: 'Fetch all tracked repos',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runWatch } = await import('../commands/watch.js')
    await runWatch(flags)
  },
})

/**
 * Watch run-once command - process tracked repos for review sessions
 * scout watch run-once [--since-last]
 */
export const watchRunOnceCommand = buildCommand({
  docs: { brief: '[experimental] Run watch once to create review sessions' },
      parameters: {
        flags: {
          sinceLast: {
            kind: 'boolean',
            brief: 'Only process changes since the last snapshot',
            optional: true,
          },
          autoReview: {
            kind: 'boolean',
            brief: 'Automatically launch differential review for new sessions',
            optional: true,
          },
          json: {
            kind: 'boolean',
            brief: 'Output JSON',
            optional: true,
          },
          format: {
            kind: 'parsed',
            parse: String,
            brief: 'Output format (json)',
            optional: true,
          },
        },
      },
  async func(flags) {
    const { runWatchRunOnce } = await import('../commands/watch-run-once.js')
    await runWatchRunOnce(flags)
  },
})

/**
 * Watch route map
 * scout watch --all
 * scout watch --repo owner/name
 * scout watch run-once [--since-last]
 */
export const watchRoutes = buildRouteMap({
  routes: {
    fetch: watchCommand,
    'run-once': watchRunOnceCommand,
    add: buildCommand({
      docs: { brief: '[experimental] Add a repo to the watch list' },
      parameters: {
        flags: {
          repo: { kind: 'parsed', parse: String, brief: 'Repository name (owner/repo)', optional: false },
          targetKind: { kind: 'parsed', parse: String, brief: 'Target component kind', optional: true },
          'target-kind': { kind: 'parsed', parse: String, brief: 'Target component kind', optional: true },
          paths: { kind: 'parsed', parse: (value: string) => value, brief: 'Tracked path (repeatable)', optional: false, variadic: true },
          intervalHours: { kind: 'parsed', parse: Number, brief: 'Polling interval in hours', optional: true },
          'interval-hours': { kind: 'parsed', parse: Number, brief: 'Polling interval in hours', optional: true },
        },
      },
      async func(flags) {
        const { runWatchAdd } = await import('../commands/watch-track.js')
        await runWatchAdd(flags as { repo: string; targetKind: string; paths: string[]; intervalHours?: number })
      },
    }),
    list: buildCommand({
      docs: { brief: '[experimental] List watch tracked entries' },
      parameters: {
        flags: {
          json: { kind: 'boolean', brief: 'Output JSON', optional: true },
          format: { kind: 'parsed', parse: String, brief: 'Output format (json)', optional: true },
        },
      },
      async func(flags) {
        const { runWatchList } = await import('../commands/watch-track.js')
        await runWatchList(flags)
      },
    }),
    remove: buildCommand({
      docs: { brief: '[experimental] Remove a repo from the watch list' },
      parameters: {
        flags: {
          repo: { kind: 'parsed', parse: String, brief: 'Repository name (owner/repo)', optional: false },
          targetKind: { kind: 'parsed', parse: String, brief: 'Target component kind', optional: true },
          'target-kind': { kind: 'parsed', parse: String, brief: 'Target component kind', optional: true },
        },
      },
      async func(flags) {
        const { runWatchRemove } = await import('../commands/watch-track.js')
        await runWatchRemove(flags as { repo: string; targetKind: string })
      },
    }),
  },
  defaultCommand: 'fetch',
  docs: { brief: '[experimental] Watch tracked repos for changes' },
})

/**
 * Session command - Generate review session directories
 * scout session --repo <owner/repo> [--kind <component>] [--max-tokens N] [--out dir]
 */
export const sessionCommand = buildCommand({
  docs: { brief: '[experimental] Generate a review session directory for differential security review' },
  parameters: {
    flags: {
      repo: {
        kind: 'parsed',
        parse: String,
        brief: 'Repository name (owner/repo)',
        optional: false,
      },
      kind: {
        kind: 'parsed',
        parse: String,
        brief: 'Target component kind for scoped review',
        optional: true,
      },
      maxTokens: {
        kind: 'parsed',
        parse: Number,
        brief: 'Maximum tokens per chunk (default: 50000)',
        optional: true,
      },
      out: {
        kind: 'parsed',
        parse: String,
        brief: 'Custom output directory',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runSession } = await import('../commands/session.js')
    await runSession(flags as { repo: string; kind?: string; maxTokens?: number; out?: string })
  },
})

/**
 * Review command - Launch claude CLI for review
 * scout review run --session <path>
 * scout review skip --session <path>
 * scout review list
 */
export const reviewCommand = buildCommand({
  docs: { brief: '[experimental] Run differential security review with claude CLI' },
  parameters: {
    flags: {
      session: {
        kind: 'parsed',
        parse: String,
        brief: 'Path to the session directory',
        optional: true,
      },
      run: {
        kind: 'boolean',
        brief: 'Run the review (default when session provided)',
        optional: true,
      },
      skip: {
        kind: 'boolean',
        brief: 'Skip the review session',
        optional: true,
      },
      list: {
        kind: 'boolean',
        brief: 'List pending reviews',
        optional: true,
      },
    },
  },
  async func(flags) {
    const { runReview } = await import('../commands/review.js')
    await runReview(flags)
  },
})
