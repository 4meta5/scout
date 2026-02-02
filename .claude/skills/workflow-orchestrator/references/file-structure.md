# Standard Project Structure

This reference documents the standard file structure for Claude Code projects.

## Root Directory

```
project/
├── CLAUDE.md           # Project guidance for Claude
├── README.md           # User-facing documentation
├── PLAN.md             # Remaining work tracker
├── RESEARCH.md         # Investigation notes
├── AGENTS.md           # Agent coordination
├── .gitignore          # Comprehensive patterns
├── package.json        # Node.js manifest
├── tsconfig.json       # TypeScript config
├── .claude/
│   └── skills/         # Project-specific skills
├── src/                # Source code
├── tests/              # Test files
└── docs/               # Additional documentation
```

## File Purposes

### CLAUDE.md

Project guidance for Claude. Contains:
- Available commands
- Code style guidelines
- Project structure overview
- Protected files list
- Installed skills references

**Template:** `templates/CLAUDE.md.template`

### README.md

User-facing documentation. Contains:
- Project description
- Quick start guide
- Features list
- Installation instructions
- Usage examples

**Template:** `templates/README.md.template`

### PLAN.md

Work tracker. Contains:
- Current sprint tasks
- Backlog items
- Completed items
- Blocked items
- Notes

**Template:** `templates/PLAN.md.template`

### RESEARCH.md

Investigation notes. Contains:
- Research topic and summary
- SOTA findings (with dates)
- Key decisions with rationale
- Open questions
- Implementation notes
- References with links

**Template:** `templates/RESEARCH.md.template`

### AGENTS.md

Agent coordination. Contains:
- Current task description
- Active agent table
- Context handoff notes
- Dependency graph
- Completed agent results

**Template:** `templates/AGENTS.md.template`

## Source Code Structure

### Node.js / TypeScript

```
src/
├── index.ts            # Main entry point
├── types.ts            # Type definitions
├── utils/              # Utility functions
├── services/           # Business logic
├── routes/             # API routes (if applicable)
└── components/         # UI components (if applicable)
```

### Tests

```
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
├── e2e/                # End-to-end tests
└── fixtures/           # Test data
```

### Documentation

```
docs/
├── api/                # API documentation
├── guides/             # User guides
└── architecture/       # Architecture decisions
```

## Monorepo Structure

For monorepos, each package follows the same pattern:

```
project/
├── CLAUDE.md           # Root guidance
├── README.md           # Project overview
├── PLAN.md             # Overall plan
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── src/
│   │   └── tests/
│   ├── cli/
│   │   ├── package.json
│   │   ├── src/
│   │   └── tests/
│   └── web/
│       ├── package.json
│       ├── src/
│       └── tests/
└── .claude/
    └── skills/         # Shared skills
```

## Skills Directory

```
.claude/
└── skills/
    ├── skill-name/
    │   ├── SKILL.md        # Main skill file
    │   ├── references/     # Supporting documentation
    │   ├── templates/      # Templates (if applicable)
    │   └── scripts/        # Helper scripts (if applicable)
    └── another-skill/
        └── SKILL.md
```

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Source files | kebab-case | `user-service.ts` |
| Test files | `.test.ts` suffix | `user-service.test.ts` |
| Type files | `.types.ts` suffix | `user.types.ts` |
| Config files | kebab-case | `eslint.config.js` |
| Documentation | UPPERCASE | `README.md`, `PLAN.md` |
| Components | PascalCase | `UserProfile.tsx` |

## Protected Files

Never read or modify:
- `.env` and `.env.*`
- `credentials.json`
- `*.pem`, `*.key`
- `secrets.*`

## Notes

- Keep root directory clean
- Group related files in directories
- Use consistent naming conventions
- Document deviations in CLAUDE.md
