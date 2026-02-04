## Installed Skills
- @.claude/skills/sync-test-skill-ezf6d6/SKILL.md
- @.claude/skills/sync-test-skill-q5lsi6/SKILL.md
- @.claude/skills/sync-test-skill-bx7vr4/SKILL.md
- @.claude/skills/sync-test-skill-lxixko/SKILL.md
- @.claude/skills/sync-test-skill-r1fyhd/SKILL.md
- @.claude/skills/sync-test-skill-9yt93c/SKILL.md
- @.claude/skills/sync-test-skill-qsesmn/SKILL.md
- @.claude/skills/sync-test-skill-7hsz00/SKILL.md
- @.claude/skills/sync-test-skill-qdk7mf/SKILL.md
- @.claude/skills/sync-test-skill-306mwq/SKILL.md
- @.claude/skills/sync-test-skill-yozi6o/SKILL.md
- @.claude/skills/sync-test-skill-8f93lm/SKILL.md
- @.claude/skills/sync-test-skill-q604ch/SKILL.md
- @.claude/skills/sync-test-skill-l8wsae/SKILL.md
- @.claude/skills/sync-test-skill-ico1fp/SKILL.md
- @.claude/skills/test-skill-1770054963683/SKILL.md
- @.claude/skills/test-skill-1770054963534/SKILL.md
- @.claude/skills/test-skill-1770054963379/SKILL.md
- @.claude/skills/test-skill-1770054916239/SKILL.md
- @.claude/skills/test-skill-1770054916092/SKILL.md
- @.claude/skills/test-skill-1770054915906/SKILL.md
- @.claude/skills/doc-maintenance/SKILL.md
- @.claude/skills/repo-hygiene/SKILL.md
- @.claude/skills/suggest-tests/SKILL.md
- @.claude/skills/workflow-orchestrator/SKILL.md
- @.claude/skills/tdd/SKILL.md
- @.claude/skills/no-workarounds/SKILL.md
- @.claude/skills/dogfood-skills/SKILL.md

## Project Overview

Scout is an OSS comparison CLI that finds actively maintained repos implementing similar components/patterns.

### Tech Stack

- **Runtime**: Node.js >= 20
- **Language**: TypeScript (strict mode, ES2022 target)
- **Package Manager**: pnpm 9.15.0
- **CLI Framework**: Stricli (lazy-loaded commands)
- **Testing**: Vitest
- **Linting**: ESLint 9 (flat config) with typescript-eslint

### Key Dependencies

- `@stricli/core` - CLI framework with command routing
- `@octokit/rest` - GitHub API client
- `execa` - Process execution (for git operations)
- `zod` - Schema validation
- `neverthrow` - Result type for error handling
- `ts-pattern` - Pattern matching
- `env-paths` - XDG-compliant paths for caching

### Command Structure

Scout provides 6 commands in a discovery pipeline:

1. **scan** - Scan a local project to fingerprint its targets
2. **discover** - Find similar OSS projects using GitHub search
3. **clone** - Shallow clone discovered repos for analysis
4. **validate** - Validate repos meet activity/maintenance criteria
5. **focus** - Identify specific files/modules matching target patterns
6. **compare** - Generate comparison report between target and OSS alternatives

### Key File Locations

```
src/
  cli/
    app.ts        # Stricli application entry point
    commands.ts   # Command definitions with flags
  commands/
    scan.ts       # Scan command implementation
    discover.ts   # Discover command implementation
    clone.ts      # Clone command implementation
    validate.ts   # Validate command implementation
    focus.ts      # Focus command implementation
    compare.ts    # Compare command implementation
  index.ts        # Library entry point (re-exports)
```

### Development Workflow (TDD)

1. Write failing test in `test/` directory
2. Run `pnpm test:watch` for continuous feedback
3. Implement feature to make test pass
4. Refactor while keeping tests green
5. Run `pnpm typecheck` before committing

### Common Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript
pnpm test             # Run tests once
pnpm test:watch       # Run tests in watch mode
pnpm typecheck        # Type check without emitting
pnpm lint             # Run ESLint on source files
```

### Module Structure

| Directory | Purpose |
|-----------|---------|
| `src/schemas/` | Zod schemas and TypeScript types |
| `src/cli/` | Stricli app and command definitions |
| `src/commands/` | Command implementations |
| `src/scan/` | Fingerprint, targets, repomap |
| `src/discovery/` | Lanes, caching, tier1 scoring |
| `src/clone/` | Hardened git ops, manifest |
| `src/validation/` | Structural checks, modernity, tier2 |
| `src/focus/` | Entrypoints, scope, bundles |
| `src/report/` | Generator, markdown formatting |
| `test/` | Unit and integration tests |

### Critical Security Note

All git operations use `core.hooksPath=/dev/null` to prevent execution of repository hooks. See `src/clone/hardened.ts`.
