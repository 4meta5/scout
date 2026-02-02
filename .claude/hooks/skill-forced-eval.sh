#!/bin/bash
# Skill Forced Evaluation Hook - SOTA 3-Step Activation
# Forces Claude to ACTIVATE skills via Skill() tool, not just evaluate them
# Achieves ~84% skill activation vs ~20% baseline (per Scott Spence's research)
#
# This hook uses dynamic skill discovery via 'skills evaluate' command
# to evaluate ALL installed skills, not just a hardcoded list.

# Read the input JSON (contains the user's prompt)
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""')

# Try to find the skills CLI
SKILLS_CLI=""
for cmd in \
  "${CLAUDE_PROJECT_DIR}/packages/skills-cli/bin/skills.js" \
  "${CLAUDE_PROJECT_DIR}/node_modules/.bin/skills" \
  "$(which skills 2>/dev/null)" \
  "${HOME}/.npm-global/bin/skills"
do
  if [ -x "$cmd" ] 2>/dev/null || [ -f "$cmd" ] 2>/dev/null; then
    SKILLS_CLI="$cmd"
    break
  fi
done

# If skills CLI found, use dynamic evaluation
if [ -n "$SKILLS_CLI" ]; then
  # Run skills evaluate for dynamic skill list
  if [[ "$SKILLS_CLI" == *.js ]]; then
    node "$SKILLS_CLI" evaluate --cwd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null && exit 0
  else
    "$SKILLS_CLI" evaluate --cwd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null && exit 0
  fi
fi

# Fallback to minimal hardcoded list if CLI not available
cat << 'ACTIVATION_CONTEXT'

## MANDATORY SKILL ACTIVATION SEQUENCE

### Step 1 - EVALUATE (do this in your response):
For each installed skill, state: [skill-name] - YES/NO - [reason]

Installed skills to evaluate:
- tdd: Trigger = implementing features, fixing bugs, refactoring code (RED→GREEN→REFACTOR)
- no-workarounds: Trigger = building tools, CLI features, automation
- dogfood-skills: Trigger = completing features in skills-cli

### Step 2 - ACTIVATE (do this immediately after Step 1):
IF any skills are YES → Use Skill(skill-name) tool for EACH relevant skill NOW
IF no skills are YES → State "No skills activated" and proceed

### Step 3 - IMPLEMENT:
Only after Step 2 is complete, proceed with implementation.

## CRITICAL REQUIREMENTS

1. You MUST call Skill() tool in Step 2 for every YES skill
2. The evaluation (Step 1) is WORTHLESS unless you ACTIVATE (Step 2) the skills
3. Do NOT skip to implementation without completing Step 2

## BLOCKING CONDITIONS - NO EXCEPTIONS

- If tdd = YES: You are BLOCKED until Phase 1 (RED) is complete - failing test required
- If no-workarounds = YES: You are BLOCKED from manual workarounds
- Skills CHAIN: If both tdd AND no-workarounds are YES, follow BOTH

This activation sequence is MANDATORY. Skipping Step 2 violates project policy.

ACTIVATION_CONTEXT

exit 0
