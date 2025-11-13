#!/bin/bash
#
# BlockchainOrchestra Framework Health Check
#
# Comprehensive system validation and monitoring.
# Checks all framework components and reports overall health.
#
# Usage: ./health-check.sh [--verbose]
#

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

VERBOSE=0
if [[ "$1" == "--verbose" ]]; then
  VERBOSE=1
fi

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Check function
check_item() {
  local category="$1"
  local name="$2"
  local command="$3"
  local level="${4:-error}"  # error, warn, info

  ((TOTAL_CHECKS++))

  if [ $VERBOSE -eq 1 ]; then
    echo -n "  Checking: $name... "
  fi

  if eval "$command" &>/dev/null; then
    if [ $VERBOSE -eq 1 ]; then
      echo -e "${GREEN}✓${NC}"
    fi
    ((PASSED_CHECKS++))
    return 0
  else
    if [ "$level" == "warn" ]; then
      if [ $VERBOSE -eq 1 ]; then
        echo -e "${YELLOW}⚠${NC}"
      else
        echo -e "  ${YELLOW}⚠${NC} $category: $name"
      fi
      ((WARNING_CHECKS++))
    else
      if [ $VERBOSE -eq 1 ]; then
        echo -e "${RED}✗${NC}"
      else
        echo -e "  ${RED}✗${NC} $category: $name"
      fi
      ((FAILED_CHECKS++))
    fi
    return 1
  fi
}

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     BlockchainOrchestra Framework Health Check        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

#
# 1. Core Framework Files
#
echo -e "${BLUE}═══ Core Framework Files ═══${NC}"
check_item "Framework" "CLAUDE.md exists" "test -f .claude/CLAUDE.md"
check_item "Framework" "Context directory exists" "test -d .claude/context"
check_item "Framework" "Scripts directory exists" "test -d .claude/scripts"
check_item "Framework" "Skills directory exists" "test -d .claude/skills"
check_item "Framework" "Agents directory exists" "test -d .claude/agents"

#
# 2. Context Files
#
echo ""
echo -e "${BLUE}═══ Context Files ═══${NC}"
check_item "Context" "PROJECT_STATE.md" "test -f .claude/context/PROJECT_STATE.md"
check_item "Context" "ARCHITECTURE.md" "test -f .claude/context/ARCHITECTURE.md"
check_item "Context" "DEPLOYMENT_STATE.md" "test -f .claude/context/DEPLOYMENT_STATE.md"
check_item "Context" "SECURITY_LOG.md" "test -f .claude/context/SECURITY_LOG.md"
check_item "Context" "TESTING_STATUS.md" "test -f .claude/context/TESTING_STATUS.md"
check_item "Context" "DECISIONS.md" "test -f .claude/context/DECISIONS.md"
check_item "Context" "ACTIVE_TASKS.md" "test -f .claude/context/ACTIVE_TASKS.md"

#
# 3. Context File Integrity
#
echo ""
echo -e "${BLUE}═══ Context File Integrity ═══${NC}"

for context_file in .claude/context/*.md; do
  if [ -f "$context_file" ]; then
    filename=$(basename "$context_file")
    # Check if checksum exists and is valid
    if [ -f "${context_file}.md5" ]; then
      check_item "Integrity" "$filename checksum" "md5sum -c ${context_file}.md5" "warn"
    else
      if [ $VERBOSE -eq 1 ]; then
        echo -e "  ${YELLOW}⚠${NC} No checksum for $filename"
      fi
      ((WARNING_CHECKS++))
    fi
  fi
done

#
# 4. Phase 1 Scripts
#
echo ""
echo -e "${BLUE}═══ Phase 1: Critical Fixes ═══${NC}"
check_item "Phase1" "update-context.sh" "test -x .claude/scripts/update-context.sh"
check_item "Phase1" "context-helpers.sh" "test -x .claude/scripts/context-helpers.sh"
check_item "Phase1" "nonce-manager.ts" "test -x .claude/scripts/nonce-manager.ts"
check_item "Phase1" "detect-secrets.sh" "test -x .claude/scripts/detect-secrets.sh"
check_item "Phase1" "Pre-commit hook installed" "test -L .git/hooks/pre-commit" "warn"

#
# 5. Phase 2 Scripts
#
echo ""
echo -e "${BLUE}═══ Phase 2: Quality Enhancements ═══${NC}"
check_item "Phase2" "rotate-context.py" "test -x .claude/scripts/rotate-context.py"
check_item "Phase2" "gas-monitor.ts" "test -x .claude/scripts/gas-monitor.ts"

#
# 6. Phase 3 Scripts
#
echo ""
echo -e "${BLUE}═══ Phase 3: Advanced Features ═══${NC}"
check_item "Phase3" "skill-budget.py" "test -x .claude/scripts/skill-budget.py" "warn"
check_item "Phase3" "pre-deploy-check.sh" "test -x .claude/scripts/pre-deploy-check.sh" "warn"
check_item "Phase3" "health-check.sh" "test -x .claude/scripts/health-check.sh" "warn"

#
# 7. Skills
#
echo ""
echo -e "${BLUE}═══ Skills ═══${NC}"

SKILL_COUNT=0
if [ -d ".claude/skills" ]; then
  SKILL_COUNT=$(find .claude/skills -name "skill.md" | wc -l)
fi

if [ $SKILL_COUNT -gt 0 ]; then
  echo -e "  ${GREEN}✓${NC} Found $SKILL_COUNT skills"
  ((PASSED_CHECKS++))
else
  echo -e "  ${YELLOW}⚠${NC} No skills found"
  ((WARNING_CHECKS++))
fi
((TOTAL_CHECKS++))

#
# 8. Agents
#
echo ""
echo -e "${BLUE}═══ Agents ═══${NC}"

AGENT_COUNT=0
if [ -d ".claude/agents" ]; then
  AGENT_COUNT=$(find .claude/agents -name "*.json" | wc -l)
fi

if [ $AGENT_COUNT -gt 0 ]; then
  echo -e "  ${GREEN}✓${NC} Found $AGENT_COUNT agents"
  ((PASSED_CHECKS++))
else
  echo -e "  ${YELLOW}⚠${NC} No agents found"
  ((WARNING_CHECKS++))
fi
((TOTAL_CHECKS++))

#
# 9. Dependencies
#
echo ""
echo -e "${BLUE}═══ System Dependencies ═══${NC}"
check_item "Dependencies" "git" "command -v git"
check_item "Dependencies" "Node.js" "command -v node" "warn"
check_item "Dependencies" "Python3" "command -v python3" "warn"
check_item "Dependencies" "jq" "command -v jq" "warn"

# Optional blockchain tools
check_item "Blockchain" "Foundry (forge)" "command -v forge" "warn"
check_item "Blockchain" "Hardhat" "command -v npx hardhat --version" "warn"
check_item "Blockchain" "Slither" "command -v slither" "warn"

#
# 10. Git Status
#
echo ""
echo -e "${BLUE}═══ Git Repository ═══${NC}"
check_item "Git" "Is git repository" "test -d .git"
check_item "Git" "No uncommitted changes" "git diff --quiet && git diff --cached --quiet" "warn"

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo -e "  ${CYAN}ℹ${NC} Current branch: $CURRENT_BRANCH"

#
# 11. Disk Space
#
echo ""
echo -e "${BLUE}═══ System Resources ═══${NC}"

AVAILABLE_KB=$(df . | tail -1 | awk '{print $4}')
AVAILABLE_MB=$((AVAILABLE_KB / 1024))
AVAILABLE_GB=$((AVAILABLE_MB / 1024))

if [ $AVAILABLE_GB -gt 5 ]; then
  echo -e "  ${GREEN}✓${NC} Disk space: ${AVAILABLE_GB}GB available"
  ((PASSED_CHECKS++))
elif [ $AVAILABLE_GB -gt 1 ]; then
  echo -e "  ${YELLOW}⚠${NC} Disk space: ${AVAILABLE_GB}GB available (low)"
  ((WARNING_CHECKS++))
else
  echo -e "  ${RED}✗${NC} Disk space: ${AVAILABLE_MB}MB available (critical)"
  ((FAILED_CHECKS++))
fi
((TOTAL_CHECKS++))

#
# 12. Context File Sizes
#
echo ""
echo -e "${BLUE}═══ Context File Sizes ═══${NC}"

if command -v python3 &> /dev/null && [ -f ".claude/scripts/rotate-context.py" ]; then
  # Run context rotation check
  ROTATION_OUTPUT=$(.claude/scripts/rotate-context.py check 2>/dev/null || echo "")

  if echo "$ROTATION_OUTPUT" | grep -q "needs_rotation"; then
    ROTATION_COUNT=$(echo "$ROTATION_OUTPUT" | grep -c "🔴" || echo "0")
    echo -e "  ${YELLOW}⚠${NC} $ROTATION_COUNT files need rotation"
    ((WARNING_CHECKS++))
  else
    echo -e "  ${GREEN}✓${NC} All context files within budget"
    ((PASSED_CHECKS++))
  fi
  ((TOTAL_CHECKS++))
fi

#
# 13. State Directories
#
echo ""
echo -e "${BLUE}═══ State Management ═══${NC}"
check_item "State" "State directory" "test -d .claude/state" "warn"
check_item "State" "Backup directory" "test -d .claude/context/.backups" "warn"
check_item "State" "Lock directory" "test -d .claude/context/.locks" "warn"

#
# 14. Nonce Manager State (if exists)
#
if [ -f ".claude/state/nonce-state.json" ]; then
  check_item "Nonce" "Nonce state file" "test -f .claude/state/nonce-state.json" "warn"

  if command -v node &> /dev/null && [ -f ".claude/scripts/nonce-manager.ts" ]; then
    # Could check nonce state here
    echo -e "  ${CYAN}ℹ${NC} Nonce manager state exists"
  fi
fi

#
# 15. Gas Monitor State (if exists)
#
if [ -f ".claude/state/gas-monitor-state.json" ]; then
  check_item "Gas" "Gas monitor state" "test -f .claude/state/gas-monitor-state.json" "warn"
fi

#
# Summary
#
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Health Summary                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

PASS_PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo -e "  Total Checks:    $TOTAL_CHECKS"
echo -e "  ${GREEN}Passed:${NC}          $PASSED_CHECKS ($PASS_PERCENTAGE%)"
echo -e "  ${YELLOW}Warnings:${NC}        $WARNING_CHECKS"
echo -e "  ${RED}Failed:${NC}          $FAILED_CHECKS"
echo ""

# Overall status
if [ $FAILED_CHECKS -eq 0 ]; then
  if [ $WARNING_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✓ Framework is healthy and fully operational${NC}"
    HEALTH_STATUS="EXCELLENT"
    EXIT_CODE=0
  else
    echo -e "${YELLOW}⚠ Framework is operational with warnings${NC}"
    echo -e "${YELLOW}  Review warnings above and address if needed${NC}"
    HEALTH_STATUS="GOOD"
    EXIT_CODE=0
  fi
else
  echo -e "${RED}✗ Framework has critical issues${NC}"
  echo -e "${RED}  Fix failures above before using framework${NC}"
  HEALTH_STATUS="POOR"
  EXIT_CODE=1
fi

echo ""
echo -e "${CYAN}Health Status:${NC} $HEALTH_STATUS"

# Recommendations
if [ $FAILED_CHECKS -gt 0 ] || [ $WARNING_CHECKS -gt 0 ]; then
  echo ""
  echo -e "${BLUE}═══ Recommendations ═══${NC}"

  if [ ! -f ".git/hooks/pre-commit" ]; then
    echo -e "  • Install pre-commit hook: ln -s ../../.claude/scripts/detect-secrets.sh .git/hooks/pre-commit"
  fi

  if ! command -v python3 &> /dev/null; then
    echo -e "  • Install Python 3 for context rotation"
  fi

  if ! command -v node &> /dev/null; then
    echo -e "  • Install Node.js for nonce/gas management"
  fi

  if ! command -v jq &> /dev/null; then
    echo -e "  • Install jq for JSON processing"
  fi

  if ! command -v slither &> /dev/null; then
    echo -e "  • Install Slither: pip install slither-analyzer"
  fi

  if [ $WARNING_CHECKS -gt 5 ]; then
    echo -e "  • Run with --verbose for detailed check results"
  fi
fi

# Save health report
REPORT_FILE=".claude/state/health-report-$(date +%Y%m%d-%H%M%S).json"
mkdir -p .claude/state

cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "$HEALTH_STATUS",
  "total_checks": $TOTAL_CHECKS,
  "passed": $PASSED_CHECKS,
  "warnings": $WARNING_CHECKS,
  "failed": $FAILED_CHECKS,
  "pass_percentage": $PASS_PERCENTAGE
}
EOF

echo ""
echo -e "${CYAN}Health report saved to:${NC} $REPORT_FILE"

exit $EXIT_CODE
