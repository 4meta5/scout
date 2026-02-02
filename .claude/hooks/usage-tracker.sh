#!/bin/bash
# Usage Tracker Hook - Tracks skill activation metrics
# Captures: session events, skill availability, skill activation, skill ignores
# Data stored in ~/.claude/usage.jsonl for analysis with 'skills stats'

# Read the input JSON (contains the user's prompt and session info)
INPUT=$(cat)

# Extract session ID and prompt
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")

# Ensure storage directory exists
STORAGE_DIR="${HOME}/.claude"
STORAGE_FILE="${STORAGE_DIR}/usage.jsonl"
mkdir -p "$STORAGE_DIR"

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Track prompt submission event
EVENT=$(jq -n \
  --arg type "prompt_submitted" \
  --arg timestamp "$TIMESTAMP" \
  --arg sessionId "$SESSION_ID" \
  --arg prompt "${PROMPT:0:200}" \
  '{type: $type, timestamp: $timestamp, sessionId: $sessionId, data: {prompt: $prompt}}')

echo "$EVENT" >> "$STORAGE_FILE"

# Track session start if this is a new session
# (Check if we've seen this session before in last 100 events)
SESSION_SEEN=$(tail -100 "$STORAGE_FILE" 2>/dev/null | grep -c "\"sessionId\":\"$SESSION_ID\"" || echo "0")
if [ "$SESSION_SEEN" -eq "0" ]; then
  SESSION_EVENT=$(jq -n \
    --arg type "session_start" \
    --arg timestamp "$TIMESTAMP" \
    --arg sessionId "$SESSION_ID" \
    '{type: $type, timestamp: $timestamp, sessionId: $sessionId, data: {}}')
  echo "$SESSION_EVENT" >> "$STORAGE_FILE"
fi

# Check for manual skill invocations in prompt (e.g., "/tdd", "Skill(tdd)")
if echo "$PROMPT" | grep -qiE '(/[a-z][-a-z]+|Skill\s*\([^)]+\))'; then
  # Extract skill name
  SKILL_NAME=$(echo "$PROMPT" | grep -oiE '(/[a-z][-a-z]+|Skill\s*\(([^)]+)\))' | head -1 | sed 's|^/||; s|Skill(||; s|)||; s|"||g; s| ||g')
  if [ -n "$SKILL_NAME" ]; then
    MANUAL_EVENT=$(jq -n \
      --arg type "skill_activated" \
      --arg timestamp "$TIMESTAMP" \
      --arg sessionId "$SESSION_ID" \
      --arg skillName "$SKILL_NAME" \
      --arg source "manual" \
      '{type: $type, timestamp: $timestamp, sessionId: $sessionId, data: {skillName: $skillName, source: $source}}')
    echo "$MANUAL_EVENT" >> "$STORAGE_FILE"
  fi
fi

# Exit successfully (don't block the prompt)
exit 0
