#!/bin/bash
# dogfood-activator.sh
# Hook script for prompt-submit to remind Claude to dogfood the skills CLI
#
# Usage: Add to .claude/settings.json hooks:
# {
#   "hooks": {
#     "prompt-submit": [
#       {
#         "command": ".claude/skills/dogfood-skills/scripts/dogfood-activator.sh"
#       }
#     ]
#   }
# }

# Check if we're in the skills project
if [[ ! -d "packages/skills-cli" ]] && [[ ! -d "../packages/skills-cli" ]]; then
    exit 0
fi

# Check if skills CLI exists and is executable
SKILLS_CLI=""
if [[ -f "packages/skills-cli/bin/skills.js" ]]; then
    SKILLS_CLI="packages/skills-cli/bin/skills.js"
elif [[ -f "../packages/skills-cli/bin/skills.js" ]]; then
    SKILLS_CLI="../packages/skills-cli/bin/skills.js"
fi

if [[ -z "$SKILLS_CLI" ]]; then
    exit 0
fi

cat << 'EOF'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOGFOODING REMINDER - Skills CLI Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are working on the skills CLI. After completing features:

1. RUN:     ./packages/skills-cli/bin/skills.js scan
2. REVIEW:  Check HIGH CONFIDENCE recommendations
3. INSTALL: ./packages/skills-cli/bin/skills.js scan --all
4. USE:     Apply installed skills in your workflow

This is NOT optional. If you skip this, respond:
"BLOCKED: DOGFOODING REQUIRED"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
