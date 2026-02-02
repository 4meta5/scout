/**
 * Component target inference from project fingerprint.
 * @module scan/targets
 */

import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ComponentTarget, Fingerprint, SearchHints } from '../schemas/index.js'

interface PackageJson {
  name?: string
  description?: string
  keywords?: string[]
  bin?: Record<string, string> | string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

/**
 * Reads package.json if it exists.
 */
async function readPackageJson(root: string): Promise<PackageJson | null> {
  try {
    const content = await readFile(join(root, 'package.json'), 'utf-8')
    return JSON.parse(content) as PackageJson
  } catch {
    return null
  }
}

/**
 * Checks if a directory exists.
 */
async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

/**
 * Checks if a file exists.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

/**
 * Rounds confidence to 2 decimal places to avoid floating point artifacts.
 * e.g., 0.4 + 0.2 = 0.6000000000000001 becomes 0.6
 */
function roundConfidence(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Detects MCP server targets.
 */
async function detectMcpServer(
  root: string,
  pkg: PackageJson | null,
  fingerprint: Fingerprint
): Promise<ComponentTarget | null> {
  const signals: string[] = []
  let confidence = 0

  // Check for @modelcontextprotocol in dependencies
  const allDeps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const hasMcpDep = Object.keys(allDeps).some((dep) => dep.includes('modelcontextprotocol'))
  if (hasMcpDep) {
    signals.push('Has @modelcontextprotocol dependency')
    confidence += 0.4
  }

  // Check for mcp in key markers
  if (fingerprint.keyMarkers.includes('mcp.json') || fingerprint.keyMarkers.includes('.mcp/')) {
    signals.push('Has MCP config file')
    confidence += 0.3
  }

  // Check for server-like files
  if (await fileExists(join(root, 'src/server.ts'))) {
    signals.push('Has src/server.ts')
    confidence += 0.2
  }

  // Check package name/description for mcp
  if (pkg?.name?.toLowerCase().includes('mcp') || pkg?.description?.toLowerCase().includes('mcp')) {
    signals.push('Package name/description mentions MCP')
    confidence += 0.2
  }

  if (signals.length === 0) return null

  const searchHints: SearchHints = {
    keywords: ['mcp', 'model-context-protocol', 'mcp-server'],
    topics: ['mcp', 'model-context-protocol', 'claude', 'anthropic'],
    languageBias: Object.keys(fingerprint.languageCounts)[0],
  }

  return {
    kind: 'mcp-server',
    confidence: roundConfidence(Math.min(confidence, 1)),
    signals,
    searchHints,
  }
}

/**
 * Detects CLI targets.
 */
function detectCli(
  _root: string,
  pkg: PackageJson | null,
  fingerprint: Fingerprint
): ComponentTarget | null {
  const signals: string[] = []
  let confidence = 0

  // Check for bin field
  if (pkg?.bin) {
    signals.push('Has bin field in package.json')
    confidence += 0.4
  }

  // Check for CLI framework dependencies
  const allDeps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const cliFrameworks = ['commander', 'yargs', 'oclif', 'meow', 'cac', '@stricli/core', 'clipanion']
  for (const framework of cliFrameworks) {
    if (allDeps[framework]) {
      signals.push(`Uses ${framework} CLI framework`)
      confidence += 0.3
      break
    }
  }

  // Check for CLI-related scripts
  if (pkg?.scripts?.['cli'] || pkg?.scripts?.['start:cli']) {
    signals.push('Has CLI-related npm scripts')
    confidence += 0.1
  }

  if (signals.length === 0) return null

  const searchHints: SearchHints = {
    keywords: ['cli', 'command-line', 'terminal'],
    topics: ['cli', 'command-line-tool', 'nodejs-cli'],
    languageBias: Object.keys(fingerprint.languageCounts)[0],
  }

  return {
    kind: 'cli',
    confidence: roundConfidence(Math.min(confidence, 1)),
    signals,
    searchHints,
  }
}

/**
 * Detects skill targets.
 */
async function detectSkill(
  root: string,
  _pkg: PackageJson | null,
  fingerprint: Fingerprint
): Promise<ComponentTarget | null> {
  const signals: string[] = []
  let confidence = 0

  // Check for SKILL.md
  if (fingerprint.keyMarkers.includes('SKILL.md')) {
    signals.push('Has SKILL.md file')
    confidence += 0.5
  }

  // Check for skills/ directory
  if (fingerprint.keyMarkers.includes('skills/') || (await dirExists(join(root, 'skills')))) {
    signals.push('Has skills/ directory')
    confidence += 0.3
  }

  // Check for .claude/skills
  if (await dirExists(join(root, '.claude/skills'))) {
    signals.push('Has .claude/skills directory')
    confidence += 0.3
  }

  if (signals.length === 0) return null

  const searchHints: SearchHints = {
    keywords: ['skill', 'claude-skill', 'ai-skill'],
    topics: ['claude', 'ai-assistant', 'skill'],
    languageBias: Object.keys(fingerprint.languageCounts)[0],
  }

  return {
    kind: 'skill',
    confidence: roundConfidence(Math.min(confidence, 1)),
    signals,
    searchHints,
  }
}

/**
 * Detects hook targets.
 */
async function detectHook(
  root: string,
  _pkg: PackageJson | null,
  fingerprint: Fingerprint
): Promise<ComponentTarget | null> {
  const signals: string[] = []
  let confidence = 0

  // Check for hooks/ directory
  if (fingerprint.keyMarkers.includes('hooks/') || (await dirExists(join(root, 'hooks')))) {
    signals.push('Has hooks/ directory')
    confidence += 0.4
  }

  // Check for .claude/hooks
  if (await dirExists(join(root, '.claude/hooks'))) {
    signals.push('Has .claude/hooks directory')
    confidence += 0.4
  }

  // Check for .husky or .git/hooks
  if ((await dirExists(join(root, '.husky'))) || (await dirExists(join(root, '.git/hooks')))) {
    signals.push('Has git hooks configuration')
    confidence += 0.2
  }

  if (signals.length === 0) return null

  const searchHints: SearchHints = {
    keywords: ['hook', 'git-hook', 'lifecycle-hook'],
    topics: ['hooks', 'git-hooks', 'automation'],
    languageBias: Object.keys(fingerprint.languageCounts)[0],
  }

  return {
    kind: 'hook',
    confidence: roundConfidence(Math.min(confidence, 1)),
    signals,
    searchHints,
  }
}

/**
 * Detects plugin targets.
 */
async function detectPlugin(
  root: string,
  pkg: PackageJson | null,
  fingerprint: Fingerprint
): Promise<ComponentTarget | null> {
  const signals: string[] = []
  let confidence = 0

  // Check for plugins/ directory
  if (fingerprint.keyMarkers.includes('plugins/') || (await dirExists(join(root, 'plugins')))) {
    signals.push('Has plugins/ directory')
    confidence += 0.3
  }

  // Check package name for plugin patterns
  if (pkg?.name?.includes('plugin') || pkg?.name?.includes('-plugin')) {
    signals.push('Package name suggests plugin')
    confidence += 0.3
  }

  // Check keywords
  if (pkg?.keywords?.some((kw) => kw.includes('plugin'))) {
    signals.push('Has plugin-related keywords')
    confidence += 0.2
  }

  if (signals.length === 0) return null

  const searchHints: SearchHints = {
    keywords: ['plugin', 'extension', 'addon'],
    topics: ['plugin', 'plugins', 'extensible'],
    languageBias: Object.keys(fingerprint.languageCounts)[0],
  }

  return {
    kind: 'plugin',
    confidence: roundConfidence(Math.min(confidence, 1)),
    signals,
    searchHints,
  }
}

/**
 * Detects library targets (fallback).
 */
function detectLibrary(
  _root: string,
  pkg: PackageJson | null,
  fingerprint: Fingerprint
): ComponentTarget | null {
  const signals: string[] = []
  let confidence = 0

  // If there's a package.json with exports, it's likely a library
  if (pkg) {
    signals.push('Has package.json')
    confidence += 0.2
  }

  // Check for TypeScript or JavaScript
  if (fingerprint.languageCounts['TypeScript'] || fingerprint.languageCounts['JavaScript']) {
    signals.push('Contains TypeScript/JavaScript code')
    confidence += 0.2
  }

  // Check for src/ directory
  if (fingerprint.keyMarkers.includes('tsconfig.json')) {
    signals.push('Has TypeScript configuration')
    confidence += 0.1
  }

  if (signals.length === 0) return null

  const primaryLang = Object.entries(fingerprint.languageCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  const searchHints: SearchHints = {
    keywords: pkg?.keywords?.slice(0, 5) ?? ['library', 'typescript'],
    topics: ['library', 'typescript', 'nodejs'].filter((t) => t),
    languageBias: primaryLang,
  }

  return {
    kind: 'library',
    confidence: roundConfidence(Math.min(confidence, 1)),
    signals,
    searchHints,
  }
}

/**
 * Infers component targets from a project fingerprint.
 */
export async function inferTargets(root: string, fingerprint: Fingerprint): Promise<ComponentTarget[]> {
  const pkg = await readPackageJson(root)
  const targets: ComponentTarget[] = []

  const detectors = [
    detectMcpServer,
    detectCli,
    detectSkill,
    detectHook,
    detectPlugin,
    detectLibrary,
  ]

  for (const detector of detectors) {
    const target = await detector(root, pkg, fingerprint)
    if (target && target.confidence > 0.2) {
      targets.push(target)
    }
  }

  // Sort by confidence descending
  return targets.sort((a, b) => b.confidence - a.confidence)
}
