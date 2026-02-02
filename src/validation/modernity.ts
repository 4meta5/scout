/**
 * Modernity checks for repositories.
 * @module validation/modernity
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModernitySignal } from '../schemas/index.js'

interface PackageJson {
  type?: string
  engines?: { node?: string }
  packageManager?: string
  devDependencies?: Record<string, string>
  dependencies?: Record<string, string>
}

interface TsConfig {
  compilerOptions?: {
    strict?: boolean
    target?: string
  }
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
 * Reads tsconfig.json if it exists.
 */
async function readTsConfig(repoPath: string): Promise<TsConfig | null> {
  try {
    const content = await readFile(join(repoPath, 'tsconfig.json'), 'utf-8')
    // Remove comments (simple approach)
    const cleaned = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    return JSON.parse(cleaned) as TsConfig
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
 * Check 1: ESM (type: module or import/export syntax dominant)
 */
async function checkEsm(repoPath: string, pkg: PackageJson | null): Promise<ModernitySignal> {
  if (pkg?.type === 'module') {
    return { check: 'ESM', passed: true, detail: 'type: module in package.json' }
  }

  // Check for .mjs files or import statements
  try {
    const srcDir = join(repoPath, 'src')
    const entries = await readdir(srcDir, { withFileTypes: true })
    for (const entry of entries.slice(0, 10)) {
      if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.ts'))) {
        const content = await readFile(join(srcDir, entry.name), 'utf-8')
        if (/^import .+ from/m.test(content)) {
          return { check: 'ESM', passed: true, detail: 'Uses ES module imports' }
        }
      }
    }
  } catch {
    // Can't check
  }

  return { check: 'ESM', passed: false, detail: 'Uses CommonJS' }
}

/**
 * Check 2: TypeScript strict mode
 */
async function checkTsStrict(repoPath: string, _pkg: PackageJson | null): Promise<ModernitySignal> {
  const tsconfig = await readTsConfig(repoPath)

  if (tsconfig?.compilerOptions?.strict === true) {
    return { check: 'TS Strict', passed: true, detail: 'strict: true in tsconfig' }
  }

  if (tsconfig) {
    return { check: 'TS Strict', passed: false, detail: 'Has tsconfig but strict not enabled' }
  }

  return { check: 'TS Strict', passed: false, detail: 'No tsconfig.json' }
}

/**
 * Check 3: ESLint flat config
 */
async function checkEslintModern(repoPath: string, _pkg: PackageJson | null): Promise<ModernitySignal> {
  // Flat config files
  const flatConfigs = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts']

  for (const config of flatConfigs) {
    if (await fileExists(join(repoPath, config))) {
      return { check: 'ESLint Modern', passed: true, detail: `Uses flat config (${config})` }
    }
  }

  // Legacy config
  const legacyConfigs = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml']
  for (const config of legacyConfigs) {
    if (await fileExists(join(repoPath, config))) {
      return { check: 'ESLint Modern', passed: false, detail: 'Uses legacy eslintrc config' }
    }
  }

  return { check: 'ESLint Modern', passed: false, detail: 'No ESLint config found' }
}

/**
 * Check 4: Package manager field or workspace
 */
async function checkPackageManager(repoPath: string, pkg: PackageJson | null): Promise<ModernitySignal> {
  if (pkg?.packageManager) {
    return { check: 'Package Manager', passed: true, detail: `packageManager: ${pkg.packageManager}` }
  }

  if (await fileExists(join(repoPath, 'pnpm-workspace.yaml'))) {
    return { check: 'Package Manager', passed: true, detail: 'Uses pnpm workspace' }
  }

  if (await fileExists(join(repoPath, 'pnpm-lock.yaml'))) {
    return { check: 'Package Manager', passed: true, detail: 'Uses pnpm (lockfile detected)' }
  }

  return { check: 'Package Manager', passed: false, detail: 'No packageManager field' }
}

/**
 * Check 5: Modern Node.js version
 */
async function checkNodeModern(repoPath: string, pkg: PackageJson | null): Promise<ModernitySignal> {
  const tsconfig = await readTsConfig(repoPath)

  // Check engines.node
  if (pkg?.engines?.node) {
    const nodeVersion = pkg.engines.node
    // Extract minimum version
    const match = nodeVersion.match(/(\d+)/)
    if (match?.[1]) {
      const minVersion = parseInt(match[1], 10)
      if (minVersion >= 18) {
        return { check: 'Node Modern', passed: true, detail: `engines.node: ${nodeVersion}` }
      }
    }
  }

  // Check target
  if (tsconfig?.compilerOptions?.target) {
    const target = tsconfig.compilerOptions.target.toUpperCase()
    const modernTargets = ['ES2020', 'ES2021', 'ES2022', 'ES2023', 'ES2024', 'ESNEXT']
    if (modernTargets.some((t) => target.includes(t))) {
      return { check: 'Node Modern', passed: true, detail: `target: ${target}` }
    }
  }

  return { check: 'Node Modern', passed: false, detail: 'No modern Node/target specified' }
}

/**
 * Check 6: Modern test runner
 */
async function checkTestRunner(repoPath: string, pkg: PackageJson | null): Promise<ModernitySignal> {
  const allDeps = { ...pkg?.dependencies, ...pkg?.devDependencies }

  if (allDeps['vitest']) {
    return { check: 'Test Runner', passed: true, detail: 'Uses Vitest' }
  }

  // Check for node:test usage
  try {
    const testDirs = ['test', 'tests', '__tests__', 'src/__tests__']
    for (const dir of testDirs) {
      const testDir = join(repoPath, dir)
      try {
        const entries = await readdir(testDir, { withFileTypes: true })
        for (const entry of entries.slice(0, 5)) {
          if (entry.isFile() && entry.name.endsWith('.test.ts')) {
            const content = await readFile(join(testDir, entry.name), 'utf-8')
            if (content.includes("from 'node:test'") || content.includes('node:test')) {
              return { check: 'Test Runner', passed: true, detail: 'Uses node:test' }
            }
          }
        }
      } catch {
        // Dir doesn't exist
      }
    }
  } catch {
    // Can't check
  }

  if (allDeps['jest']) {
    return { check: 'Test Runner', passed: true, detail: 'Uses Jest' }
  }

  return { check: 'Test Runner', passed: false, detail: 'No modern test runner detected' }
}

/**
 * Runs all modernity checks on a repository.
 */
export async function checkModernity(repoPath: string): Promise<ModernitySignal[]> {
  const pkg = await readPackageJson(repoPath)

  const checks = [
    checkEsm,
    checkTsStrict,
    checkEslintModern,
    checkPackageManager,
    checkNodeModern,
    checkTestRunner,
  ]

  const results: ModernitySignal[] = []
  for (const check of checks) {
    results.push(await check(repoPath, pkg))
  }

  return results
}

/**
 * Computes modernity score from signals.
 */
export function computeModernityScore(signals: ModernitySignal[]): number {
  if (signals.length === 0) return 0
  const passed = signals.filter((s) => s.passed).length
  return passed / signals.length
}
