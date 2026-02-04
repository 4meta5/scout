# scout

Find actively maintained OSS implementing patterns similar to your project.

[![npm](https://img.shields.io/npm/v/@4meta5/scout)](https://npmjs.com/package/@4meta5/scout)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

```bash
npx @4meta5/scout scan && npx @4meta5/scout discover
```

## What It Does

Scout analyzes your codebase and finds comparable open source projects. It:

- **Scans** your project to identify what you're building (CLI, MCP server, plugin, etc.)
- **Discovers** GitHub repos with similar patterns and active maintenance
- **Validates** structural matches and modern development practices
- **Generates** focused context bundles for code exploration

## Quick Start

1. Set your GitHub token:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

2. Run the pipeline in your project:

```bash
# Fingerprint your project
scout scan

# Find similar repos
scout discover

# Clone top candidates
scout clone

# Validate and score
scout validate

# Generate context bundles
scout focus

# Create comparison report
scout compare
```

3. Open `.scout/REPORT.md` for results.

## Installation

```bash
npm install -g @4meta5/scout
```

Or use directly with npx:

```bash
npx @4meta5/scout scan
```

## Commands

| Command | Description | Output |
|---------|-------------|--------|
| `scan` | Fingerprint local project | `fingerprint.json`, `targets.json` |
| `discover` | Search GitHub for similar repos | `candidates.tier1.json` |
| `clone` | Shallow clone top candidates | `clone-manifest.json` |
| `validate` | Check structural matches | `validate-summary.json` |
| `focus` | Generate context bundles | `FOCUS.md` per repo |
| `compare` | Create comparison report | `REPORT.md`, `report.json` |

### Compact Digest Mode

For LLM-friendly output, use the `--digest` flag:

```bash
scout compare --digest
```

This generates a 1-2 page summary in `.scout/DIGEST.md` plus `digest.json`, suitable for Engram ingestion or Claude context windows.

**Digest output structure:**
- Top recommendation with score, license, and entry point
- Compact alternatives table (top 5)
- Pipeline summary (discovered → cloned → validated)

## V1 Core Pipeline

Scout V1 provides a stable, one-shot OSS comparison pipeline:

| Command | Status | Description |
|---------|--------|-------------|
| `scan` | Stable | Fingerprint local project |
| `discover` | Stable | Search GitHub for similar repos |
| `clone` | Stable | Shallow clone top candidates |
| `validate` | Stable | Check structural matches |
| `focus` | Stable | Generate context bundles |
| `compare` | Stable | Create comparison report |

These 6 commands are the **V1 guarantee**. They are stable, tested, and suitable for production use.

---

## Experimental Features

**Warning: Not part of core guarantees. May change without notice.**

### Watch / Review

Track validated repos over time and generate differential review sessions.

```bash
npm install @4meta5/scout-watch
```

Once installed, these commands become available:

- `scout watch add` - Add repo to tracking
- `scout watch list` - List tracked repos
- `scout watch remove` - Remove from tracking
- `scout watch run-once` - Process updates
- `scout review run` - Launch differential review

See [@4meta5/scout-watch](https://www.npmjs.com/package/@4meta5/scout-watch) for full documentation.

## How Scoring Works

Scout uses a two-tier scoring system.

**Tier 1 (Discovery)** scores based on:
- Recency: How recently the repo was updated
- Activity: Stars and forks as popularity signal
- Lane hits: How many search patterns matched

**Tier 2 (Validation)** adds:
- Structural match: Does it implement the same patterns?
- Modernity: ESM, TypeScript strict, modern tooling

## Configuration

Scout uses XDG-compliant paths. Global config lives at `~/.config/scout/config.json`.

Project config in `.scoutrc.json` overrides global settings:

```json
{
  "github": {
    "token": "ghp_..."
  },
  "discovery": {
    "recencyWindowDays": 90,
    "maxCandidatesTier1": 50,
    "cloneBudget": 5
  }
}
```

Environment variable `GITHUB_TOKEN` takes precedence over config files.

## Detection Targets

Scout identifies these component patterns:

| Kind | Signals |
|------|---------|
| `mcp-server` | @modelcontextprotocol deps, MCP config files |
| `cli` | bin field, commander/yargs/stricli deps |
| `skill` | SKILL.md, skills/ directory |
| `hook` | hooks/ directory, git hook patterns |
| `plugin` | plugins/ directory, plugin manifests |
| `library` | Fallback for npm packages |

## Output Structure

All outputs go to `.scout/` by default:

```
.scout/
  fingerprint.json      # Project analysis
  targets.json          # Detected component types
  candidates.tier1.json # Discovery results
  clone-manifest.json   # Cloned repos
  validate-summary.json # Validation scores
  focus/
    owner-repo/
      FOCUS.md          # Context bundle
      RUN_HINTS.md      # Build/test commands
      PROVENANCE.md     # Source tracking
  REPORT.md             # Final comparison
  report.json           # Machine-readable report
```

## Development

This is a pnpm workspace. Core package is at root, optional packages under `packages/`.

```bash
pnpm install          # Install all dependencies
pnpm build            # Build core only
pnpm build:all        # Build all packages
pnpm test             # Test core only
pnpm test:all         # Test all packages
pnpm typecheck:all    # Type check all packages
```

## Requirements

- Node.js 20+
- GitHub token with `public_repo` scope

## License

MIT
