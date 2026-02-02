#!/usr/bin/env node
/**
 * Scout CLI Application
 * Stricli application with lazy-loaded commands
 */

import { buildApplication, buildRouteMap } from '@stricli/core'
import {
  scanCommand,
  discoverCommand,
  cloneCommand,
  validateCommand,
  focusCommand,
  compareCommand,
} from './commands.js'

const routes = buildRouteMap({
  routes: {
    scan: scanCommand,
    discover: discoverCommand,
    clone: cloneCommand,
    validate: validateCommand,
    focus: focusCommand,
    compare: compareCommand,
  },
  docs: {
    brief: 'Scout CLI - Find actively maintained OSS implementing similar patterns',
    hideRoute: {},
  },
})

export const app = buildApplication(routes, {
  name: 'scout',
  versionInfo: { currentVersion: '0.1.0' },
})

// Run the CLI when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { run } = await import('@stricli/core')
  await run(app, process.argv.slice(2), {
    process: {
      stdout: process.stdout,
      stderr: process.stderr,
      exitCode: process.exitCode ?? null,
    },
  })
}
