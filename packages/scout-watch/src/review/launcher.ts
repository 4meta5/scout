/**
 * Review launcher - Runs claude CLI on review sessions.
 * @module review/launcher
 *
 * Shells out to the `claude` CLI with the session's
 * REVIEW_INSTRUCTIONS.md as the initial prompt.
 */

import { execa } from 'execa'
import { access, constants } from 'node:fs/promises'
import { join } from 'node:path'
import {
  getReviewSessionByPath,
  markReviewSessionRunning,
  markReviewSessionComplete,
} from '../watch/db.js'

/**
 * Options for launching a review.
 */
export interface LaunchOptions {
  /** Path to the session directory */
  sessionPath: string
  /** Whether to run interactively (inherit stdio) */
  interactive?: boolean
  /** Timeout in milliseconds (default: 30 minutes) */
  timeout?: number
}

/**
 * Result of a review launch.
 */
export interface LaunchResult {
  /** Exit code from claude CLI */
  exitCode: number
  /** Whether the review completed successfully */
  success: boolean
  /** Error message if failed */
  error?: string | undefined
}

/**
 * Default timeout for review (30 minutes).
 */
const DEFAULT_TIMEOUT = 30 * 60 * 1000

/**
 * Checks if the claude CLI is available.
 */
export async function isClaudeAvailable(): Promise<boolean> {
  try {
    await execa('which', ['claude'])
    return true
  } catch {
    return false
  }
}

/**
 * Validates a session directory has required files.
 */
export async function validateSession(sessionPath: string): Promise<{ valid: boolean; error?: string }> {
  const requiredFiles = [
    'REVIEW_INSTRUCTIONS.md',
    'review_context.json',
    'repo',
    'OUTPUT',
  ]

  for (const file of requiredFiles) {
    try {
      await access(join(sessionPath, file), constants.F_OK)
    } catch {
      return {
        valid: false,
        error: `Missing required file or directory: ${file}`,
      }
    }
  }

  // Check for diff.patch or chunks/
  try {
    await access(join(sessionPath, 'diff.patch'), constants.F_OK)
  } catch {
    try {
      await access(join(sessionPath, 'chunks'), constants.F_OK)
    } catch {
      return {
        valid: false,
        error: 'Missing diff.patch or chunks/ directory',
      }
    }
  }

  return { valid: true }
}

/**
 * Launches claude CLI for a review session.
 *
 * Runs claude with REVIEW_INSTRUCTIONS.md as the input prompt,
 * with the session directory as the working directory.
 */
export async function launchReview(options: LaunchOptions): Promise<LaunchResult> {
  const { sessionPath, interactive = true, timeout = DEFAULT_TIMEOUT } = options

  // Validate session
  const validation = await validateSession(sessionPath)
  if (!validation.valid) {
    return {
      exitCode: 1,
      success: false,
      error: validation.error,
    }
  }

  // Check claude availability
  const claudeAvailable = await isClaudeAvailable()
  if (!claudeAvailable) {
    return {
      exitCode: 1,
      success: false,
      error: 'claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code',
    }
  }

  // Get session from database (if tracked)
  const session = await getReviewSessionByPath(sessionPath)

  // Mark as running
  if (session !== null) {
    await markReviewSessionRunning(session.id)
  }

  try {
    // Launch claude with the review instructions
    // Using @file syntax to pass the instructions file
    const result = await execa('claude', ['@REVIEW_INSTRUCTIONS.md'], {
      cwd: sessionPath,
      stdio: interactive ? 'inherit' : 'pipe',
      timeout,
      reject: false,
    })

    const exitCode = result.exitCode ?? 1
    const success = exitCode === 0

    // Update session status
    if (session !== null) {
      await markReviewSessionComplete(
        session.id,
        success ? 'success' : 'failure',
        exitCode
      )
    }

    return {
      exitCode,
      success,
      error: success ? undefined : `claude exited with code ${exitCode}`,
    }
  } catch (error) {
    // Handle error with type checking
    const execaError = error as {
      exitCode?: number
      timedOut?: boolean
      signal?: string
      message?: string
    }

    const exitCode = execaError.exitCode ?? 1

    // Update session status
    if (session !== null) {
      await markReviewSessionComplete(session.id, 'failure', exitCode)
    }

    // Handle timeout
    if (execaError.timedOut === true) {
      return {
        exitCode: 124, // Standard timeout exit code
        success: false,
        error: `Review timed out after ${timeout / 1000} seconds`,
      }
    }

    // Handle signal termination
    if (execaError.signal !== undefined) {
      return {
        exitCode: 137, // SIGKILL
        success: false,
        error: 'Review was terminated',
      }
    }

    return {
      exitCode,
      success: false,
      error: execaError.message ?? 'Unknown error',
    }
  }
}

/**
 * Skips a review session (marks as skipped in DB).
 */
export async function skipReview(sessionPath: string): Promise<void> {
  const session = await getReviewSessionByPath(sessionPath)
  if (session !== null) {
    await markReviewSessionComplete(session.id, 'skipped', null)
  }
}
