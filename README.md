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

## Watch (V2)

Track validated repos over time and generate differential review sessions.

```bash
# Add a repo to watch (repeat --paths as needed)
scout watch add --repo owner/repo --target-kind cli --paths src/cli --paths src/bin
# JSON output
scout watch add --repo owner/repo --target-kind cli --paths src/cli --json

# List tracked entries (JSON output)
scout watch list --json
# or
scout watch list --format json

# Remove a tracked entry
scout watch remove --repo owner/repo --target-kind cli
# JSON output
scout watch remove --repo owner/repo --target-kind cli --json

# Run watch once (optionally auto-review)
scout watch run-once --since-last --auto-review
# JSON output
scout watch run-once --json
```

Notes:
- Flags accept both `--targetKind` and `--target-kind` (same for `--intervalHours` / `--interval-hours`).
- `--json` or `--format json` prints machine-readable output for `watch add/list/remove/run-once`.

### Watch JSON Output

`watch add --json`:
```json
{
  "action": "add",
  "repo": "owner/repo",
  "repoUrl": "https://github.com/owner/repo.git",
  "targetKind": "cli",
  "paths": ["src/cli"],
  "intervalHours": 24
}
```

`watch list --json`:
```json
[
  {
    "repoFullName": "owner/repo",
    "repoUrl": "https://github.com/owner/repo.git",
    "targetKind": "cli",
    "trackedPaths": ["src/cli", "src/bin"],
    "enabled": true,
    "intervalHours": 24
  }
]
```

`watch remove --json`:
```json
{
  "action": "remove",
  "repo": "owner/repo",
  "targetKind": "cli",
  "removed": true
}
```

`watch run-once --json`:
```json
{
  "sessionPath": "/path/to/session",
  "driftFlag": false,
  "diffStats": {
    "filesChanged": 1,
    "insertions": 2,
    "deletions": 3
  }
}
```

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

## Requirements

- Node.js 20+
- GitHub token with `public_repo` scope

## License

MIT
