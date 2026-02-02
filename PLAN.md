# SCOUT CLI V1 - Implementation Plan

> One-shot OSS comparison CLI that finds actively maintained repos implementing similar components/patterns.

## Current Sprint
- None.

## Completed
- [x] V2 watch schema and helpers (2026-02-02)
- [x] `watch run-once` with real session generation and auto-review (2026-02-02)
- [x] V2 watch add/list/remove commands with JSON output (2026-02-02)
- [x] Watch list format alias and table header output (2026-02-02)
- [x] Kebab-case flag support for watch add/remove (2026-02-02)
- [x] Watch JSON output schema docs and examples (2026-02-02)
- [x] `watch run-once` JSON output alias test (2026-02-02)

## Overview

Scout is a TypeScript CLI that:
1. **Scans** a local project to fingerprint its targets (MCP servers, CLIs, skills, hooks, plugins)
2. **Discovers** GitHub repos matching those patterns (metadata + tier1 scoring)
3. **Clones** top candidates (shallow, hardened, cached)
4. **Validates** structural matches and modernity signals (tier2 scoring)
5. **Focuses** generates depth-budgeted context bundles for agentic exploration
6. **Compares** produces actionable reports with entrypoints and scope

## Skills Configuration (Execute First)

Before implementation, configure development skills from `/Users/amar/skillex/skills`:

```bash
cd /Users/amar/skillex/skills

# Install core skills
./packages/cli/bin/skills.js add workflow-orchestrator tdd no-workarounds dogfood-skills --cwd /Users/amar/skillex/scout

# Install supporting skills
./packages/cli/bin/skills.js add doc-maintenance repo-hygiene suggest-tests --cwd /Users/amar/skillex/scout

# Install hooks for automatic activation
./packages/cli/bin/skills.js hook add skill-forced-eval usage-tracker --cwd /Users/amar/skillex/scout
```

**Skill Workflow Chains:**
- New feature: `tdd (RED→GREEN→REFACTOR) → doc-maintenance → dogfood-skills → repo-hygiene`
- Bug fix: `tdd + no-workarounds → doc-maintenance`
- Task completion: `doc-maintenance → repo-hygiene`

---

## Tech Stack (2026 SOTA)

| Package | Purpose | Notes |
|---------|---------|-------|
| `@stricli/core` | CLI framework | Zero-dep, type-safe, lazy-loaded commands |
| `@octokit/rest` | GitHub API | Rate limiting, search, repo metadata |
| `execa` | Shell execution | Git operations with explicit args |
| `zod` | Schemas | Data contracts, config validation |
| `env-paths` | Cache dirs | XDG-compliant paths |
| `ts-pattern` | Pattern matching | Exhaustive discriminated unions |
| `neverthrow` | Result types | Error handling without exceptions |
| `vitest` | Testing | TDD, golden path tests |

**Why Stricli over commander/yargs:**
- Zero dependencies (lean bundle)
- Lazy module loading (fast startup)
- Native TypeScript type flow
- Bloomberg-backed, enterprise-proven

---

## Execution Waves (Parallel Agent Dispatch)

### Wave 1: Foundation (3 agents parallel)

| Agent | Task | Output Files |
|-------|------|--------------|
| **A1** | Zod schemas + TypeScript types | `src/schemas/*.ts` |
| **A2** | Config loader + cache paths | `src/config.ts`, `src/cache.ts` |
| **A3** | Project scaffold + CLI skeleton | `package.json`, `tsconfig.json`, `src/cli/*.ts` |

**A1 Context - Schemas:**
```
Create Zod schemas:
- targets.json: ComponentTarget[] with kind, confidence, signals, searchHints
- fingerprint.json: root, commit, timestamp, languageCounts, keyMarkers
- candidates.tier1.json: CandidateRepoTier1 with repo, url, stars, licenseSpdx, laneHits, tier1Score
- validate.json: ValidationResult with matchedTargets, modernitySignals, tier2Score
- focus/: FOCUS.md, FOCUS.json, RUN_HINTS.md, PROVENANCE.md structures
- report.json: CompareReport structure

Use zod v3, export both schemas and inferred types.
Pattern: /Users/amar/skillex/skills/packages/skill-loader/src/skill-schema.ts
```

**A2 Context - Config:**
```
Implement configuration:
- Global config: ~/.config/scout/config.json
- Project config: .scoutrc.json (merged with global)
- Cache: env-paths for repos, api-cache, runs

Config fields:
- github.token (env GITHUB_TOKEN first)
- discovery: recencyWindowDays(90), maxCandidatesTier1(50), cloneBudget(5), excludeKeywords[], allowLicenses[]
- scoring: wRecency(0.55), wActivity(0.25), wLanes(0.20), wStructural(0.35), wModernity(0.20)
- focus: entrypointsPerTarget(5), maxDirsPerTarget(8), maxFilesPerDir(25)
- caching: ttlHours(24), maxPagesPerLane(2)
- rateLimit: searchRequestsPerMinute(20), backoffBaseMs(750), backoffMaxMs(15000)
```

**A3 Context - Scaffold:**
```
Scaffold Scout CLI with Stricli:
- package.json: name "@4meta5/scout", type "module", bin "scout"
- tsconfig.json: strict, ESNext, NodeNext
- src/cli/app.ts: Stricli application with lazy-loaded commands
- Commands: scan, discover, clone, validate, focus, compare

Configure skills in .claude/settings.local.json and create CLAUDE.md.
```

**Handoff Artifacts:**
- `src/schemas/index.ts` - All type definitions
- `src/config.ts` - loadConfig(), getConfigPath()
- `src/cache.ts` - getCachePath(), repo/api/runs paths
- `src/cli/app.ts` - CLI entry point

---

### Wave 2: Core Commands (3 agents parallel)

**Dependencies:** Wave 1 complete

| Agent | Task | Output Files |
|-------|------|--------------|
| **B1** | Scan command + targets inference | `src/commands/scan.ts`, `src/scan/*.ts` |
| **B2** | Discover with caching/throttling | `src/commands/discover.ts`, `src/discovery/*.ts` |
| **B3** | Hardened clone + manifest | `src/commands/clone.ts`, `src/clone/*.ts` |

**B1 Context - Scan:**
```
Implement: scout scan [--root <path>] [--out <dir>]

Outputs: fingerprint.json, targets.json, repomap.txt

1. Walk filesystem respecting .gitignore
2. Produce repomap.txt with capped depth/entries
3. Extract signals:
   - package.json deps/devDeps
   - tsconfig strict/target
   - markers: SKILL.md, skills/, hooks/, plugins/, mcp, eslint configs
   - README titles/keywords (snippet only)
4. Derive ComponentTargets:
   - For each kind (mcp-server, cli, skill, hook, plugin, library)
   - Accumulate evidence, compute confidence
   - Generate searchHints: keywords, topics, languageBias

TDD: Write failing tests first. Pattern: fixtures in test/fixtures/
```

**B2 Context - Discover:**
```
Implement: scout discover [--root <path>] [--targets <targets.json>] [--out <dir>]

Outputs: candidates.tier1.json

1. Query lanes (metadata only, no structural claims):
   - Lane A: language + keywords (from targets[].searchHints.keywords)
   - Lane B: topics (from targets[].searchHints.topics)
   - Lane C: dependency hints (@modelcontextprotocol) as keyword
2. For each lane: fetch up to maxPagesPerLane, cache (TTL 24h)
3. Dedup by repo full_name, laneHits = set
4. Filter early:
   - Drop archived, forks (configurable)
   - Drop license not in allowLicenses (keep unknown, deprioritize)
   - Drop description/name contains excludeKeywords
   - Drop pushedAt > recencyWindowDays
5. Compute tier1 score:
   - recencyNorm = clamp01(1 - daysSincePush / recencyWindowDays)
   - activityNorm = clamp01(log(stars + forks + 1) / activityLogDivisor)
   - laneNorm = min(laneHitsCount, laneHitCap)
   - tier1 = wRecency*recencyNorm + wActivity*activityNorm + wLanes*laneNorm

Rate limiting: backoff strategy. Pattern: /Users/amar/skillex/skills/packages/cli/src/middleware/backoff.ts
TDD required.
```

**B3 Context - Clone:**
```
Implement: scout clone [--in <candidates.tier1.json>] [--top <K>] [--out <dir>]

Outputs: clone-manifest.json (repo→localPath→sha)

1. Sort candidates by tier1 descending
2. Pick top cloneBudget (default 5)
3. Clone shallow: git -c core.hooksPath=/dev/null clone --depth=1 <url> <path>
4. Store head SHA
5. Skip network if repo already cached
6. Never delete clone on validation failure

CRITICAL: Disable git hooks for ALL git operations:
  git -c core.hooksPath=/dev/null clone ...
  git -c core.hooksPath=/dev/null fetch ...
  git -c core.hooksPath=/dev/null checkout ...

Cache path: <cache>/repos/<owner>/<repo>
TDD required. NO WORKAROUNDS: If clone fails, fix clone logic.
```

**Handoff Artifacts:**
- `src/commands/scan.ts` - Scan command
- `src/scan/fingerprint.ts` - Fingerprint generation
- `src/scan/targets.ts` - Target inference
- `src/commands/discover.ts` - Discovery command
- `src/discovery/lanes.ts` - Query lane builders
- `src/discovery/cache.ts` - API response caching
- `src/discovery/scoring.ts` - Tier1 scoring
- `src/commands/clone.ts` - Clone command
- `src/clone/hardened.ts` - Hardened git operations
- `src/clone/manifest.ts` - Manifest generation

---

### Wave 3: Analysis Commands (2 agents parallel)

**Dependencies:** Wave 2 complete

| Agent | Task | Output Files |
|-------|------|--------------|
| **C1** | Validate + modernity + tier2 scoring | `src/commands/validate.ts`, `src/validation/*.ts` |
| **C2** | Focus generator with depth budget | `src/commands/focus.ts`, `src/focus/*.ts` |

**C1 Context - Validate:**
```
Implement: scout validate [--in <clone-manifest.json>] [--targets <targets.json>] [--out <dir>]

Outputs: validate.json per repo + validate-summary.json

Structural validation per cached repo:
- Skills: SKILL.md, plugins/*/SKILL.md, skills/ directory
- MCP server: @modelcontextprotocol in deps, server files, rg for "mcp" config
- CLI: package.json bin, commander/oclif/yargs deps, entry file exists
- Hooks: hooks/ directory or git hook scripts (DO NOT EXECUTE)
- Plugin: plugin-like folders + manifests

Record evidence, focusRoots, structuralMatchCount = unique matched kinds

Modernity checks (5-6, cheap):
1. ESM: "type":"module" OR import/from > require
2. TS strict: tsconfig strict true
3. ESLint modern: eslint.config.* (flat config)
4. packageManager field: pnpm-workspace.yaml or packageManager
5. Node engines modern: engines.node >= 18 OR target >= ES2020
6. Modern test runner: vitest OR node:test OR jest

modernityScore = passedCount / totalChecks

Tier2 scoring:
tier2 = tier1 + wStructural*structuralMatchCount + wModernity*modernityScore

Precompute entrypointCandidates: {kind, paths: string[]}
TDD required.
```

**C2 Context - Focus:**
```
Implement: scout focus [--validated <validate-summary.json>] [--out <dir>]

Outputs per repo: FOCUS.md, FOCUS.json, RUN_HINTS.md, PROVENANCE.md
Also: focus-index.md listing all repos

Entrypoints (max entrypointsPerTarget per kind):
- README/SKILL.md first when relevant
- index/barrel files (index.ts, src/index.ts, lib/index.js)
- highest inbound-import files within focusRoots
- bin target, server.ts, index.ts

Scope:
- Include focusRoots directories
- Cap to maxDirsPerTarget, maxFilesPerDir
- Include top files (smaller first, or by "mentions" count)

RUN_HINTS.md: scripts (test/build/lint/dev)
PROVENANCE.md: repo url, sha, license, tier scores, tool version, run id

TDD required.
```

**Handoff Artifacts:**
- `src/commands/validate.ts` - Validation command
- `src/validation/structural.ts` - Kind detection
- `src/validation/modernity.ts` - Modernity checks
- `src/validation/scoring.ts` - Tier2 scoring
- `src/commands/focus.ts` - Focus command
- `src/focus/entrypoints.ts` - Entrypoint detection
- `src/focus/scope.ts` - Depth budget tracking
- `src/focus/bundle.ts` - Bundle generation

---

### Wave 4: Reporting + Tests (2 agents, semi-parallel)

**Dependencies:** Wave 3 complete

| Agent | Task | Output Files |
|-------|------|--------------|
| **D1** | Compare report | `src/commands/compare.ts`, `src/report/*.ts` |
| **D2** | Golden path tests | `test/golden/*.test.ts`, `test/fixtures/*` |

**D1 Context - Compare:**
```
Implement: scout compare [--validated <validate-summary.json>] [--focus <focus-index>] [--out <dir>]

Outputs: REPORT.md, report.json

REPORT.md includes:
- Summary of targets and signals
- Ranked validated repos by tier2 (with breakdown)
- Per repo:
  - matched target kinds
  - modernity signals summary
  - key entrypoints (top 3-5)
  - scope roots
  - license + pushedAt

report.json: full structured output for machine use

TDD required.
```

**D2 Context - Golden Tests:**
```
Golden path integration tests (prevent regressions):

Fixtures (vendored in test/fixtures):
- mcp-ish repo
- skills/plugins-ish repo
- cli-ish repo

Mock GitHub API responses (recorded JSON).

Pipeline: scan → discover(mock) → cloneIfNeeded(local override) → validate → focus → compare

Assertions:
- discover returns non-zero candidates
- validate matches expected kinds (no false negatives)
- ranking order matches expected
- FOCUS entrypoints bounded, include expected files

Unit tests:
- fingerprint stability: scan fixture twice → identical hash
- scoring determinism: fixed inputs → stable tier1/tier2
- modernity checks: each check works on fixtures

Use Vitest. TDD already applied in prior phases.
```

**Handoff Artifacts:**
- `src/commands/compare.ts` - Compare command
- `src/report/generator.ts` - Report generation
- `src/report/markdown.ts` - Markdown formatting
- `test/golden/e2e.test.ts` - End-to-end tests
- `test/fixtures/` - Test fixtures

---

## Repository Layout

```
src/
  cli/
    app.ts              # Stricli application
    commands.ts         # Command tree
  schemas/
    index.ts            # All Zod schemas + types
    targets.ts          # ComponentTarget schema
    candidates.ts       # CandidateRepoTier1 schema
    validation.ts       # ValidationResult schema
    focus.ts            # Focus bundle schemas
    report.ts           # CompareReport schema
  config.ts             # Config loading/merging
  cache.ts              # Cache path resolution
  commands/
    scan.ts
    discover.ts
    clone.ts
    validate.ts
    focus.ts
    compare.ts
  scan/
    fingerprint.ts
    targets.ts
    repomap.ts
  discovery/
    lanes.ts
    cache.ts
    scoring.ts
    dedup.ts
  clone/
    hardened.ts
    manifest.ts
  validation/
    structural.ts
    modernity.ts
    scoring.ts
  focus/
    entrypoints.ts
    scope.ts
    bundle.ts
  report/
    generator.ts
    markdown.ts
test/
  fixtures/
    mcp-repo/
    skills-repo/
    cli-repo/
    mock-api/
  golden/
    scan.test.ts
    discover.test.ts
    clone.test.ts
    validate.test.ts
    focus.test.ts
    compare.test.ts
    e2e.test.ts
```

---

## CLI Commands (V1)

```
scout scan [--root <path>] [--out <dir>]
  → fingerprint.json, targets.json, repomap.txt

scout discover [--root <path>] [--targets <targets.json>] [--out <dir>]
  → candidates.tier1.json

scout clone [--in <candidates.tier1.json>] [--top <K>] [--out <dir>]
  → clone-manifest.json

scout validate [--in <clone-manifest.json>] [--targets <targets.json>] [--out <dir>]
  → validate.json, validate-summary.json

scout focus [--validated <validate-summary.json>] [--out <dir>]
  → FOCUS.md, FOCUS.json, RUN_HINTS.md, PROVENANCE.md per repo
  → focus-index.md

scout compare [--validated <validate-summary.json>] [--focus <focus-index>] [--out <dir>]
  → REPORT.md, report.json
```

---

## Non-Goals (V1)

- No MCP server mode
- No cron/watch state or diff monitoring
- No "extract component into tmp" or dependency walking
- No Sourcegraph integration
- No plugin manifest architecture
- No OSS Insight API integration (V1.1)

---

## Verification Plan

1. **Unit Tests**: Each module has tests, TDD enforced
2. **Golden Path Tests**: End-to-end pipeline with fixtures
3. **Manual Verification**: Run on a real project (e.g., skills repo itself)
4. **Checklist**:
   - [x] candidates.tier1.json produced (2026-02-02)
   - [x] clones in platform-correct cache dir (2026-02-02)
   - [x] validate-summary.json with tier2 scores (2026-02-02)
   - [x] per-repo FOCUS bundles (2026-02-02)
   - [x] REPORT.md actionable (entrypoints + scoped dirs) (2026-02-02)
   - [x] Clone commands never execute hooks (2026-02-02)
   - [x] Discovery respects license allowlist (2026-02-02)
   - [x] Scoring breakdown explains repo selection (2026-02-02)

---

## Completed (2026-02-02)

All 4 implementation waves completed:

| Wave | Status | Components |
|------|--------|------------|
| Wave 1 | Complete | Zod schemas, config, cache, CLI scaffold |
| Wave 2 | Complete | scan, discover, clone commands |
| Wave 3 | Complete | validate, focus commands |
| Wave 4 | Complete | compare command, report generation, tests |

**Test Results**: 71 tests passing across 4 test files
**ESLint**: 0 errors, 0 warnings
**Build**: Successful

---

## Agent Dispatch Summary

| Wave | Agents | Parallel | Est. Complexity |
|------|--------|----------|-----------------|
| 1 | A1, A2, A3 | 3 parallel | Foundation |
| 2 | B1, B2, B3 | 3 parallel | Core commands |
| 3 | C1, C2 | 2 parallel | Analysis |
| 4 | D1, D2 | 2 semi-parallel | Reporting + tests |

**Total**: 10 agent dispatches across 4 waves
**Critical path**: A1 → B2 → C1 → D2

---

## Context Handoff Protocol

Each agent must:
1. Read schemas from `src/schemas/index.ts`
2. Read config from `src/config.ts`
3. Follow TDD: RED → GREEN → REFACTOR
4. Update PLAN.md with progress
5. Add JSDoc comments to exports
