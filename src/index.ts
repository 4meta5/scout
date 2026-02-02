/**
 * Scout CLI - OSS comparison tool
 *
 * This module exports the key types and functions for library usage.
 * For CLI usage, run the scout command directly.
 *
 * @module scout
 */

// Re-export schemas and types
export * from './schemas/index.js'

// Re-export configuration
export { loadConfig, getConfigPath, getDefaultConfig } from './config.js'
export type { ScoutConfig } from './config.js'

// Re-export cache utilities
export {
  getCachePath,
  getRepoCachePath,
  getApiCachePath,
  getRunPath,
  ensureCacheDir,
  getBaseCachePath,
} from './cache.js'

// Re-export scan utilities
export { generateFingerprint } from './scan/fingerprint.js'
export { inferTargets } from './scan/targets.js'
export { generateRepomap } from './scan/repomap.js'

// Re-export discovery utilities
export { buildSearchLanes, augmentQuery } from './discovery/lanes.js'
export { getCached, setCached, hashKey } from './discovery/cache.js'
export { computeTier1Score, isLicenseAllowed, shouldExclude, isTooOld } from './discovery/scoring.js'
export { deduplicateCandidates } from './discovery/dedup.js'

// Re-export clone utilities
export { shallowClone, isGitRepo, getHeadSha, normalizeGitUrl } from './clone/hardened.js'
export { createManifest, addEntry, saveManifest, loadManifest } from './clone/manifest.js'

// Re-export validation utilities
export { validateStructure } from './validation/structural.js'
export { checkModernity, computeModernityScore } from './validation/modernity.js'
export { computeTier2Score } from './validation/scoring.js'

// Re-export focus utilities
export { resolveEntrypoints, findBarrelFiles } from './focus/entrypoints.js'
export { collectScopeFiles, deduplicateScopeRoots } from './focus/scope.js'
export {
  generateBundle,
  generateProvenance,
  generateRunHints,
  formatFocusMd,
  formatProvenanceMd,
  formatRunHintsMd,
} from './focus/bundle.js'

// Re-export report utilities
export { generateReport, loadFingerprint, loadFocusIndex } from './report/generator.js'
export { formatReportMd, formatTerminalSummary } from './report/markdown.js'

// Re-export watch utilities
export * from './watch/index.js'

// Re-export review utilities
export * from './review/index.js'
