/**
 * SQLite database connection and operations for watch mode.
 * @module watch/db
 *
 * Uses better-sqlite3 with WAL mode for concurrent reads.
 * Database location: <cache>/watch/scout.db
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { getCachePath } from '../cache.js'
import type {
  TrackedRepo,
  TrackedPath,
  ReviewSession,
  TrackedRepoInput,
  TrackedPathInput,
  ReviewSessionInput,
  ReviewStatus,
} from '../schemas/watch.js'
import type { ComponentKind } from '../schemas/targets.js'

/**
 * SQL schema for watch mode tables.
 */
const SCHEMA_SQL = `
-- V2 watch tables
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  default_branch TEXT,
  license_spdx TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracked (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER REFERENCES repos(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  tracked_paths_json TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  interval_hours INTEGER DEFAULT 24,
  UNIQUE(repo_id, target_kind)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER REFERENCES repos(id) ON DELETE CASCADE,
  head_sha TEXT NOT NULL,
  checked_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER REFERENCES repos(id) ON DELETE CASCADE,
  from_sha TEXT NOT NULL,
  to_sha TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  diff_stats_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  drift_flag INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  change_id INTEGER REFERENCES changes(id) ON DELETE CASCADE,
  session_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_repos_full_name ON repos(full_name);
CREATE INDEX IF NOT EXISTS idx_tracked_repo_id ON tracked(repo_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_repo_id ON snapshots(repo_id);
CREATE INDEX IF NOT EXISTS idx_changes_repo_id ON changes(repo_id);
CREATE INDEX IF NOT EXISTS idx_sessions_change_id ON sessions(change_id);

-- Tracked repositories
CREATE TABLE IF NOT EXISTS tracked_repos (
  id INTEGER PRIMARY KEY,
  repo TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  local_path TEXT NOT NULL,
  baseline_sha TEXT NOT NULL,
  last_sha TEXT,
  tier2_score REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tracked paths per repo (for drift detection)
CREATE TABLE IF NOT EXISTS tracked_paths (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER REFERENCES tracked_repos(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  UNIQUE(repo_id, path)
);

-- Generated review sessions
CREATE TABLE IF NOT EXISTS review_sessions (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER REFERENCES tracked_repos(id) ON DELETE CASCADE,
  session_path TEXT NOT NULL,
  old_sha TEXT NOT NULL,
  new_sha TEXT NOT NULL,
  target_kind TEXT,
  status TEXT DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 1,
  started_at TEXT,
  finished_at TEXT,
  exit_code INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracked_repos_repo ON tracked_repos(repo);
CREATE INDEX IF NOT EXISTS idx_tracked_paths_repo_id ON tracked_paths(repo_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_repo_id ON review_sessions(repo_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_status ON review_sessions(status);
`

/**
 * Returns the path to the watch database directory.
 */
export function getWatchDbDir(): string {
  return join(getCachePath('runs'), 'watch')
}

/**
 * Returns the path to the watch database file.
 */
export function getWatchDbPath(): string {
  return join(getWatchDbDir(), 'scout.db')
}

/**
 * Singleton database instance.
 */
let dbInstance: Database.Database | null = null

/**
 * Opens or returns the existing database connection.
 * Enables WAL mode and foreign keys.
 */
export async function getDb(): Promise<Database.Database> {
  if (dbInstance !== null) {
    return dbInstance
  }

  const dbDir = getWatchDbDir()
  await mkdir(dbDir, { recursive: true })

  const dbPath = getWatchDbPath()
  dbInstance = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  dbInstance.pragma('journal_mode = WAL')
  // Enable foreign key constraints
  dbInstance.pragma('foreign_keys = ON')

  // Initialize schema
  dbInstance.exec(SCHEMA_SQL)

  return dbInstance
}

/**
 * Closes the database connection.
 */
export function closeDb(): void {
  if (dbInstance !== null) {
    dbInstance.close()
    dbInstance = null
  }
}

// Row type helpers for mapping database rows to schema types
interface TrackedRepoRow {
  id: number
  repo: string
  url: string
  local_path: string
  baseline_sha: string
  last_sha: string | null
  tier2_score: number
  created_at: string
}

interface TrackedPathRow {
  id: number
  repo_id: number
  kind: string
  path: string
}

interface ReviewSessionRow {
  id: number
  repo_id: number
  session_path: string
  old_sha: string
  new_sha: string
  target_kind: string | null
  status: string
  chunk_count: number
  started_at: string | null
  finished_at: string | null
  exit_code: number | null
  created_at: string
}

// ============================================================================
// V2 Watch Helpers
// ============================================================================

export interface RepoV2Input {
  fullName: string
  url: string
  defaultBranch: string | null
  licenseSpdx: string | null
}

export interface TrackedV2Input {
  repoId: number
  targetKind: string
  trackedPaths: string[]
  enabled: boolean
  intervalHours: number
}

export interface TrackedV2Row {
  repoFullName: string
  repoUrl: string
  targetKind: string
  trackedPaths: string[]
  enabled: boolean
  intervalHours: number
}

export async function insertRepoV2(input: RepoV2Input): Promise<number> {
  const db = await getDb()
  const stmt = db.prepare(`
    INSERT INTO repos (full_name, url, default_branch, license_spdx)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(full_name) DO UPDATE SET
      url = excluded.url,
      default_branch = excluded.default_branch,
      license_spdx = excluded.license_spdx
  `)
  const result = stmt.run(input.fullName, input.url, input.defaultBranch, input.licenseSpdx)

  if (typeof result.lastInsertRowid === 'number' && result.lastInsertRowid > 0) {
    return result.lastInsertRowid
  }

  const row = db.prepare('SELECT id FROM repos WHERE full_name = ?').get(input.fullName) as { id: number }
  return row.id
}

export async function upsertTrackedV2(input: TrackedV2Input): Promise<number> {
  const db = await getDb()
  const trackedJson = JSON.stringify(input.trackedPaths)
  const stmt = db.prepare(`
    INSERT INTO tracked (repo_id, target_kind, tracked_paths_json, enabled, interval_hours)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(repo_id, target_kind) DO UPDATE SET
      tracked_paths_json = excluded.tracked_paths_json,
      enabled = excluded.enabled,
      interval_hours = excluded.interval_hours
  `)
  const result = stmt.run(
    input.repoId,
    input.targetKind,
    trackedJson,
    input.enabled ? 1 : 0,
    input.intervalHours
  )

  if (typeof result.lastInsertRowid === 'number' && result.lastInsertRowid > 0) {
    return result.lastInsertRowid
  }

  const row = db.prepare('SELECT id FROM tracked WHERE repo_id = ? AND target_kind = ?').get(
    input.repoId,
    input.targetKind
  ) as { id: number }
  return row.id
}

export async function listTrackedV2(): Promise<TrackedV2Row[]> {
  const db = await getDb()
  const rows = db.prepare(`
    SELECT r.full_name, r.url, t.target_kind, t.tracked_paths_json, t.enabled, t.interval_hours
    FROM tracked t
    JOIN repos r ON r.id = t.repo_id
    ORDER BY r.full_name, t.target_kind
  `).all() as Array<{
    full_name: string
    url: string
    target_kind: string
    tracked_paths_json: string
    enabled: number
    interval_hours: number
  }>

  return rows.map(r => ({
    repoFullName: r.full_name,
    repoUrl: r.url,
    targetKind: r.target_kind,
    trackedPaths: JSON.parse(r.tracked_paths_json) as string[],
    enabled: r.enabled === 1,
    intervalHours: r.interval_hours,
  }))
}

export async function removeTrackedV2(repoFullName: string, targetKind: string): Promise<boolean> {
  const db = await getDb()
  const row = db.prepare('SELECT id FROM repos WHERE full_name = ?').get(repoFullName) as { id: number } | undefined
  if (row === undefined) return false

  const result = db.prepare('DELETE FROM tracked WHERE repo_id = ? AND target_kind = ?').run(row.id, targetKind)
  return result.changes > 0
}

/**
 * Maps a database row to a TrackedRepo object.
 */
function mapTrackedRepoRow(row: TrackedRepoRow): TrackedRepo {
  return {
    id: row.id,
    repo: row.repo,
    url: row.url,
    localPath: row.local_path,
    baselineSha: row.baseline_sha,
    lastSha: row.last_sha,
    tier2Score: row.tier2_score,
    createdAt: row.created_at,
  }
}

/**
 * Maps a database row to a TrackedPath object.
 */
function mapTrackedPathRow(row: TrackedPathRow): TrackedPath {
  return {
    id: row.id,
    repoId: row.repo_id,
    kind: row.kind as ComponentKind,
    path: row.path,
  }
}

/**
 * Maps a database row to a ReviewSession object.
 */
function mapReviewSessionRow(row: ReviewSessionRow): ReviewSession {
  return {
    id: row.id,
    repoId: row.repo_id,
    sessionPath: row.session_path,
    oldSha: row.old_sha,
    newSha: row.new_sha,
    targetKind: row.target_kind as ComponentKind | null,
    status: row.status as ReviewStatus,
    chunkCount: row.chunk_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    exitCode: row.exit_code,
    createdAt: row.created_at,
  }
}

// ============================================================================
// Tracked Repos CRUD
// ============================================================================

/**
 * Inserts a new tracked repository.
 * Returns the inserted row ID.
 */
export async function insertTrackedRepo(input: TrackedRepoInput): Promise<number> {
  const db = await getDb()
  const stmt = db.prepare(`
    INSERT INTO tracked_repos (repo, url, local_path, baseline_sha, tier2_score)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(input.repo, input.url, input.localPath, input.baselineSha, input.tier2Score)
  return result.lastInsertRowid as number
}

/**
 * Gets a tracked repository by full name (owner/repo).
 */
export async function getTrackedRepoByName(repo: string): Promise<TrackedRepo | null> {
  const db = await getDb()
  const stmt = db.prepare('SELECT * FROM tracked_repos WHERE repo = ?')
  const row = stmt.get(repo) as TrackedRepoRow | undefined
  return row !== undefined ? mapTrackedRepoRow(row) : null
}

/**
 * Gets a tracked repository by ID.
 */
export async function getTrackedRepoById(id: number): Promise<TrackedRepo | null> {
  const db = await getDb()
  const stmt = db.prepare('SELECT * FROM tracked_repos WHERE id = ?')
  const row = stmt.get(id) as TrackedRepoRow | undefined
  return row !== undefined ? mapTrackedRepoRow(row) : null
}

/**
 * Gets all tracked repositories.
 */
export async function getAllTrackedRepos(): Promise<TrackedRepo[]> {
  const db = await getDb()
  const stmt = db.prepare('SELECT * FROM tracked_repos ORDER BY tier2_score DESC')
  const rows = stmt.all() as TrackedRepoRow[]
  return rows.map(mapTrackedRepoRow)
}

/**
 * Updates the last_sha for a tracked repository.
 */
export async function updateTrackedRepoSha(id: number, lastSha: string): Promise<void> {
  const db = await getDb()
  const stmt = db.prepare('UPDATE tracked_repos SET last_sha = ? WHERE id = ?')
  stmt.run(lastSha, id)
}

/**
 * Gets tracked repos with pending changes (last_sha differs from baseline_sha).
 */
export async function getTrackedReposWithChanges(): Promise<TrackedRepo[]> {
  const db = await getDb()
  const stmt = db.prepare(`
    SELECT * FROM tracked_repos
    WHERE last_sha IS NOT NULL AND last_sha != baseline_sha
    ORDER BY tier2_score DESC
  `)
  const rows = stmt.all() as TrackedRepoRow[]
  return rows.map(mapTrackedRepoRow)
}

/**
 * Deletes a tracked repository by ID.
 * Also deletes associated paths and sessions (via CASCADE).
 */
export async function deleteTrackedRepo(id: number): Promise<void> {
  const db = await getDb()
  const stmt = db.prepare('DELETE FROM tracked_repos WHERE id = ?')
  stmt.run(id)
}

// ============================================================================
// Tracked Paths CRUD
// ============================================================================

/**
 * Inserts a new tracked path.
 * Returns the inserted row ID.
 */
export async function insertTrackedPath(input: TrackedPathInput): Promise<number> {
  const db = await getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO tracked_paths (repo_id, kind, path)
    VALUES (?, ?, ?)
  `)
  const result = stmt.run(input.repoId, input.kind, input.path)
  return result.lastInsertRowid as number
}

/**
 * Inserts multiple tracked paths in a single transaction.
 */
export async function insertTrackedPaths(inputs: TrackedPathInput[]): Promise<void> {
  const db = await getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO tracked_paths (repo_id, kind, path)
    VALUES (?, ?, ?)
  `)
  const insertMany = db.transaction((paths: TrackedPathInput[]) => {
    for (const p of paths) {
      stmt.run(p.repoId, p.kind, p.path)
    }
  })
  insertMany(inputs)
}

/**
 * Gets all tracked paths for a repository.
 */
export async function getTrackedPathsByRepoId(repoId: number): Promise<TrackedPath[]> {
  const db = await getDb()
  const stmt = db.prepare('SELECT * FROM tracked_paths WHERE repo_id = ?')
  const rows = stmt.all(repoId) as TrackedPathRow[]
  return rows.map(mapTrackedPathRow)
}

/**
 * Deletes all tracked paths for a repository.
 */
export async function deleteTrackedPathsByRepoId(repoId: number): Promise<void> {
  const db = await getDb()
  const stmt = db.prepare('DELETE FROM tracked_paths WHERE repo_id = ?')
  stmt.run(repoId)
}

// ============================================================================
// Review Sessions CRUD
// ============================================================================

/**
 * Inserts a new review session.
 * Returns the inserted row ID.
 */
export async function insertReviewSession(input: ReviewSessionInput): Promise<number> {
  const db = await getDb()
  const stmt = db.prepare(`
    INSERT INTO review_sessions (repo_id, session_path, old_sha, new_sha, target_kind, chunk_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    input.repoId,
    input.sessionPath,
    input.oldSha,
    input.newSha,
    input.targetKind,
    input.chunkCount
  )
  return result.lastInsertRowid as number
}

/**
 * Gets a review session by ID.
 */
export async function getReviewSessionById(id: number): Promise<ReviewSession | null> {
  const db = await getDb()
  const stmt = db.prepare('SELECT * FROM review_sessions WHERE id = ?')
  const row = stmt.get(id) as ReviewSessionRow | undefined
  return row !== undefined ? mapReviewSessionRow(row) : null
}

/**
 * Gets a review session by session path.
 */
export async function getReviewSessionByPath(sessionPath: string): Promise<ReviewSession | null> {
  const db = await getDb()
  const stmt = db.prepare('SELECT * FROM review_sessions WHERE session_path = ?')
  const row = stmt.get(sessionPath) as ReviewSessionRow | undefined
  return row !== undefined ? mapReviewSessionRow(row) : null
}

/**
 * Gets all review sessions for a repository.
 */
export async function getReviewSessionsByRepoId(repoId: number): Promise<ReviewSession[]> {
  const db = await getDb()
  const stmt = db.prepare('SELECT * FROM review_sessions WHERE repo_id = ? ORDER BY created_at DESC')
  const rows = stmt.all(repoId) as ReviewSessionRow[]
  return rows.map(mapReviewSessionRow)
}

/**
 * Gets pending review sessions.
 */
export async function getPendingReviewSessions(): Promise<ReviewSession[]> {
  const db = await getDb()
  const stmt = db.prepare(`
    SELECT * FROM review_sessions
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `)
  const rows = stmt.all() as ReviewSessionRow[]
  return rows.map(mapReviewSessionRow)
}

/**
 * Updates review session status to running.
 */
export async function markReviewSessionRunning(id: number): Promise<void> {
  const db = await getDb()
  const stmt = db.prepare(`
    UPDATE review_sessions
    SET status = 'running', started_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run(id)
}

/**
 * Updates review session status to success or failure.
 */
export async function markReviewSessionComplete(
  id: number,
  status: 'success' | 'failure' | 'skipped',
  exitCode: number | null
): Promise<void> {
  const db = await getDb()
  const stmt = db.prepare(`
    UPDATE review_sessions
    SET status = ?, finished_at = datetime('now'), exit_code = ?
    WHERE id = ?
  `)
  stmt.run(status, exitCode, id)
}

/**
 * Deletes a review session by ID.
 */
export async function deleteReviewSession(id: number): Promise<void> {
  const db = await getDb()
  const stmt = db.prepare('DELETE FROM review_sessions WHERE id = ?')
  stmt.run(id)
}

/**
 * Gets the latest review session for a repo with specific SHA range.
 */
export async function getExistingReviewSession(
  repoId: number,
  oldSha: string,
  newSha: string,
  targetKind: ComponentKind | null
): Promise<ReviewSession | null> {
  const db = await getDb()
  const stmt = db.prepare(`
    SELECT * FROM review_sessions
    WHERE repo_id = ? AND old_sha = ? AND new_sha = ? AND target_kind IS ?
    ORDER BY created_at DESC
    LIMIT 1
  `)
  const row = stmt.get(repoId, oldSha, newSha, targetKind) as ReviewSessionRow | undefined
  return row !== undefined ? mapReviewSessionRow(row) : null
}
