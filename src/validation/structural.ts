/**
 * Structural validation to detect component kinds in cloned repos.
 * @module validation/structural
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { MatchedTarget } from '../schemas/index.js'

interface PackageJson {
  name?: string
  bin?: Record<string, string> | string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/**
 * Reads package.json if it exists.
 */
async function readPackageJson(repoPath: string): Promise<PackageJson | null> {
  try {
    const content = await readFile(join(repoPath, 'package.json'), 'utf-8')
    return JSON.parse(content) as PackageJson
  } catch {
    return null
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
 * Searches for a pattern in files (simplified grep).
 */
async function containsPattern(repoPath: string, pattern: RegExp, extensions: string[] = ['.ts', '.js', '.json']): Promise<boolean> {
  const searchDirs = ['src', 'lib', '.']

  for (const dir of searchDirs) {
    const dirPath = join(repoPath, dir)
    if (!(await dirExists(dirPath))) continue

    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      for (const entry of entries.slice(0, 50)) {
        if (!entry.isFile()) continue
        if (!extensions.some((ext) => entry.name.endsWith(ext))) continue

        try {
          const content = await readFile(join(dirPath, entry.name), 'utf-8')
          if (pattern.test(content)) return true
        } catch {
          // Can't read file
        }
      }
    } catch {
      // Can't read directory
    }
  }

  return false
}

/**
 * Detects MCP server presence.
 */
async function detectMcpServer(repoPath: string, pkg: PackageJson | null): Promise<MatchedTarget | null> {
  const evidence: string[] = []
  const focusRoots: string[] = []

  // Check dependencies
  const allDeps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const hasMcpDep = Object.keys(allDeps).some((dep) => dep.includes('modelcontextprotocol'))
  if (hasMcpDep) {
    evidence.push('Has @modelcontextprotocol dependency')
  }

  // Check for server files
  if (await fileExists(join(repoPath, 'src/server.ts'))) {
    evidence.push('Has src/server.ts')
    focusRoots.push('src')
  }

  // Check for mcp config
  if (await fileExists(join(repoPath, 'mcp.json'))) {
    evidence.push('Has mcp.json config')
  }

  // Check for MCP patterns in code
  if (await containsPattern(repoPath, /McpServer|MCP_/i)) {
    evidence.push('Code contains MCP patterns')
  }

  if (evidence.length === 0) return null

  return {
    kind: 'mcp-server',
    evidence,
    focusRoots: focusRoots.length > 0 ? focusRoots : ['src', 'lib'],
  }
}

/**
 * Detects CLI presence.
 */
async function detectCli(repoPath: string, pkg: PackageJson | null): Promise<MatchedTarget | null> {
  const evidence: string[] = []
  const focusRoots: string[] = []

  // Check for bin field
  if (pkg?.bin) {
    evidence.push('Has bin field in package.json')

    // Add bin entry paths as focus roots
    const binPaths = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin)
    for (const binPath of binPaths) {
      const dir = binPath.replace(/\/[^/]+$/, '')
      if (dir && !focusRoots.includes(dir)) {
        focusRoots.push(dir)
      }
    }
  }

  // Check for CLI frameworks
  const allDeps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const cliFrameworks = ['commander', 'yargs', 'oclif', 'meow', 'cac', '@stricli/core', 'clipanion']
  for (const framework of cliFrameworks) {
    if (allDeps[framework]) {
      evidence.push(`Uses ${framework} CLI framework`)
      break
    }
  }

  // Check for CLI-related files
  if (await fileExists(join(repoPath, 'src/cli.ts')) || await fileExists(join(repoPath, 'src/cli/index.ts'))) {
    evidence.push('Has CLI entry file')
    focusRoots.push('src/cli')
  }

  if (evidence.length === 0) return null

  return {
    kind: 'cli',
    evidence,
    focusRoots: focusRoots.length > 0 ? focusRoots : ['src', 'bin'],
  }
}

/**
 * Detects skill presence.
 */
async function detectSkill(repoPath: string, _pkg: PackageJson | null): Promise<MatchedTarget | null> {
  const evidence: string[] = []
  const focusRoots: string[] = []

  // Check for SKILL.md
  if (await fileExists(join(repoPath, 'SKILL.md'))) {
    evidence.push('Has SKILL.md file')
    focusRoots.push('.')
  }

  // Check for skills directory
  if (await dirExists(join(repoPath, 'skills'))) {
    evidence.push('Has skills/ directory')
    focusRoots.push('skills')
  }

  // Check for .claude/skills
  if (await dirExists(join(repoPath, '.claude/skills'))) {
    evidence.push('Has .claude/skills directory')
    focusRoots.push('.claude/skills')
  }

  // Check for plugins/*/SKILL.md
  if (await dirExists(join(repoPath, 'plugins'))) {
    try {
      const plugins = await readdir(join(repoPath, 'plugins'), { withFileTypes: true })
      for (const plugin of plugins) {
        if (plugin.isDirectory()) {
          if (await fileExists(join(repoPath, 'plugins', plugin.name, 'SKILL.md'))) {
            evidence.push(`Has plugins/${plugin.name}/SKILL.md`)
            focusRoots.push(`plugins/${plugin.name}`)
          }
        }
      }
    } catch {
      // Can't read plugins dir
    }
  }

  if (evidence.length === 0) return null

  return {
    kind: 'skill',
    evidence,
    focusRoots,
  }
}

/**
 * Detects hook presence.
 */
async function detectHook(repoPath: string, _pkg: PackageJson | null): Promise<MatchedTarget | null> {
  const evidence: string[] = []
  const focusRoots: string[] = []

  // Check for hooks directory
  if (await dirExists(join(repoPath, 'hooks'))) {
    evidence.push('Has hooks/ directory')
    focusRoots.push('hooks')
  }

  // Check for .claude/hooks
  if (await dirExists(join(repoPath, '.claude/hooks'))) {
    evidence.push('Has .claude/hooks directory')
    focusRoots.push('.claude/hooks')
  }

  // Check for .husky
  if (await dirExists(join(repoPath, '.husky'))) {
    evidence.push('Has .husky directory')
    focusRoots.push('.husky')
  }

  if (evidence.length === 0) return null

  return {
    kind: 'hook',
    evidence,
    focusRoots,
  }
}

/**
 * Detects plugin presence.
 */
async function detectPlugin(repoPath: string, pkg: PackageJson | null): Promise<MatchedTarget | null> {
  const evidence: string[] = []
  const focusRoots: string[] = []

  // Check for plugins directory
  if (await dirExists(join(repoPath, 'plugins'))) {
    evidence.push('Has plugins/ directory')
    focusRoots.push('plugins')
  }

  // Check package name
  if (pkg?.name?.includes('plugin')) {
    evidence.push('Package name suggests plugin')
  }

  if (evidence.length === 0) return null

  return {
    kind: 'plugin',
    evidence,
    focusRoots: focusRoots.length > 0 ? focusRoots : ['src'],
  }
}

/**
 * Detects library presence (fallback).
 */
async function detectLibrary(repoPath: string, pkg: PackageJson | null): Promise<MatchedTarget | null> {
  const evidence: string[] = []

  if (pkg) {
    evidence.push('Has package.json')
  }

  if (await dirExists(join(repoPath, 'src'))) {
    evidence.push('Has src/ directory')
  }

  // This is the fallback, so minimal evidence is enough
  if (evidence.length === 0) return null

  return {
    kind: 'library',
    evidence,
    focusRoots: ['src', 'lib'],
  }
}

/**
 * Validates a repository and returns matched targets.
 */
export async function validateStructure(repoPath: string): Promise<MatchedTarget[]> {
  const pkg = await readPackageJson(repoPath)
  const matched: MatchedTarget[] = []

  const detectors: Array<(path: string, pkg: PackageJson | null) => Promise<MatchedTarget | null>> = [
    detectMcpServer,
    detectCli,
    detectSkill,
    detectHook,
    detectPlugin,
    detectLibrary,
  ]

  for (const detector of detectors) {
    const target = await detector(repoPath, pkg)
    if (target) {
      matched.push(target)
    }
  }

  return matched
}
