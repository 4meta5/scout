/**
 * Scan command - Scan a local project to fingerprint its targets.
 * @module commands/scan
 *
 * Outputs:
 * - fingerprint.json: Project fingerprint with language stats and markers
 * - targets.json: Detected component targets with search hints
 * - repomap.txt: Visual tree of project structure
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { generateFingerprint } from '../scan/fingerprint.js'
import { inferTargets } from '../scan/targets.js'
import { generateRepomap } from '../scan/repomap.js'
import { FingerprintSchema, ComponentTargetsSchema } from '../schemas/index.js'

export interface ScanFlags {
  root?: string
  out?: string
}

export async function runScan(flags: ScanFlags): Promise<void> {
  const projectRoot = resolve(flags.root ?? process.cwd())
  const outputDir = resolve(flags.out ?? join(projectRoot, '.scout'))

  console.log(`🔍 Scanning project: ${projectRoot}`)

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true })

  // Generate fingerprint
  console.log('  → Generating fingerprint...')
  const fingerprint = await generateFingerprint(projectRoot)

  // Validate and write fingerprint
  const validatedFingerprint = FingerprintSchema.parse(fingerprint)
  const fingerprintPath = join(outputDir, 'fingerprint.json')
  await writeFile(fingerprintPath, JSON.stringify(validatedFingerprint, null, 2))
  console.log(`  ✓ Fingerprint: ${fingerprintPath}`)

  // Show language stats
  const langEntries = Object.entries(fingerprint.languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  if (langEntries.length > 0) {
    console.log(`    Languages: ${langEntries.map(([lang, count]) => `${lang}(${count})`).join(', ')}`)
  }

  // Show key markers
  if (fingerprint.keyMarkers.length > 0) {
    console.log(`    Markers: ${fingerprint.keyMarkers.join(', ')}`)
  }

  // Infer targets
  console.log('  → Inferring targets...')
  const targets = await inferTargets(projectRoot, fingerprint)

  // Validate and write targets
  const validatedTargets = ComponentTargetsSchema.parse(targets)
  const targetsPath = join(outputDir, 'targets.json')
  await writeFile(targetsPath, JSON.stringify(validatedTargets, null, 2))
  console.log(`  ✓ Targets: ${targetsPath}`)

  // Show detected targets
  for (const target of targets) {
    const confidence = Math.round(target.confidence * 100)
    console.log(`    ${target.kind} (${confidence}% confidence)`)
    for (const signal of target.signals.slice(0, 2)) {
      console.log(`      - ${signal}`)
    }
  }

  // Generate repomap
  console.log('  → Generating repomap...')
  const repomap = await generateRepomap(projectRoot)
  const repomapPath = join(outputDir, 'repomap.txt')
  await writeFile(repomapPath, repomap)
  console.log(`  ✓ Repomap: ${repomapPath}`)

  console.log('')
  console.log(`✅ Scan complete. Output: ${outputDir}`)
  console.log(`   Next: scout discover --root ${projectRoot}`)
}
