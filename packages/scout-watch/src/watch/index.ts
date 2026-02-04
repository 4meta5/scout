/**
 * Watch mode module - Track repos and generate differential security reviews.
 * @module watch
 */

// Database operations
export {
  getDb,
  closeDb,
  getWatchDbDir,
  getWatchDbPath,
  insertTrackedRepo,
  getTrackedRepoByName,
  getTrackedRepoById,
  getAllTrackedRepos,
  updateTrackedRepoSha,
  getTrackedReposWithChanges,
  deleteTrackedRepo,
  insertTrackedPath,
  insertTrackedPaths,
  getTrackedPathsByRepoId,
  deleteTrackedPathsByRepoId,
  insertReviewSession,
  getReviewSessionById,
  getReviewSessionByPath,
  getReviewSessionsByRepoId,
  getPendingReviewSessions,
  markReviewSessionRunning,
  markReviewSessionComplete,
  deleteReviewSession,
  getExistingReviewSession,
  // V2 helpers
  insertRepoV2,
  upsertTrackedV2,
  listTrackedV2,
  removeTrackedV2,
  type RepoV2Input,
  type TrackedV2Input,
  type TrackedV2Row,
} from './db.js'

// Lock operations
export {
  acquireWatchLock,
  isWatchLocked,
  withWatchLock,
  getLockFilePath,
  type LockHandle,
} from './lock.js'

// Track operations
export {
  loadValidationSummary,
  trackRepo,
  trackFromValidationSummary,
  trackSingleRepo,
  listTrackedRepos,
  runTrackWithLock,
  type TrackResult,
} from './track.js'

// Fetch operations
export {
  fetchRepo,
  fetchAllRepos,
  fetchRepoById,
  getReposWithPendingChanges,
  checkoutSha,
  createWorktree,
  removeWorktree,
  runFetchWithLock,
  type FetchResult,
} from './fetch.js'

// Diff operations
export {
  generateDiff,
  getChangedFiles,
  getChangedFilesWithStatus,
  filterExcludedFiles,
  type DiffOptions,
  type DiffResult,
} from './diff.js'

// Drift detection
export {
  detectDrift,
  mapDriftedPaths,
  type DriftResult,
} from './drift.js'

// Chunking
export {
  estimateTokens,
  chunkDiff,
  getChunkFilename,
  generateChunkHeader,
  summarizeChunking,
  DEFAULT_MAX_TOKENS,
  type DiffChunk,
  type ChunkResult,
} from './chunk.js'

// Session generation
export {
  generateSession,
  getReviewsBasePath,
  generateSessionPath,
  type SessionOptions,
  type SessionResult,
} from './session.js'

// Watch session (run-once workflow)
export {
  createWatchSession,
  type WatchSessionInput,
  type WatchSessionResult,
} from './session-watch.js'

// Remote operations
export {
  fetchRemoteHead,
} from './remote.js'

// Run-once workflow
export {
  runWatchOnce,
  type RunOnceDeps,
} from './run-once.js'
