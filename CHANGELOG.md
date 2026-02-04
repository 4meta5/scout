# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-03

### Added

- **@4meta5/scout-watch**: New optional package for tracking validated repos over time
  - `watch add` - Add repo to tracking
  - `watch list` - List tracked repos
  - `watch remove` - Remove from tracking
  - `watch run-once` - Process updates
  - `review run` - Launch differential review sessions
  - SQLite-backed persistence with proper locking
  - Chunked diff processing for large repos
  - Session management with context tracking

- Compact digest mode (`--digest` flag) for LLM-friendly output
- Documentation for experimental watch/review features

### Changed

- README updated with experimental features section
- Package structure now supports optional extensions via workspace

## [0.1.0] - 2026-01-30

### Added

- Initial release
- Core 6-command pipeline: scan, discover, clone, validate, focus, compare
- GitHub API integration via Octokit
- Two-tier scoring system (Tier 1: Discovery, Tier 2: Validation)
- XDG-compliant configuration paths
- Hardened git operations (hooks disabled for security)
- Detection targets: mcp-server, cli, skill, hook, plugin, library
