#!/bin/bash
#
# Pre-Deployment Safety Checks
#
# Comprehensive validation before deploying contracts.
# Addresses multiple edge cases:
# - EC 7.3: Wrong network deployment
# - EC 8.2: Uncommitted changes conflict
# - Security, test coverage, and configuration validation
#
# Usage: ./pre-deploy-check.sh <network> [contract]
#

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REQUIRED_COVERAGE=90
MAINNET_NETWORKS=("ethereum" "mainnet" "bsc" "avalanche" "polygon")

# Parse arguments
NETWORK="${1:-}"
CONTRACT="${2:-all}"

if [ -z "$NETWORK" ]; then
  echo -e "${RED}Error: Network required${NC}"
  echo "Usage: $0 <network> [contract]"
  echo ""
  echo "Examples:"
  echo "  $0 sepolia"
  echo "  $0 ethereum StakingRewards"
  exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Pre-Deployment Safety Checks                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Network:${NC} $NETWORK"
echo -e "${BLUE}Contract:${NC} $CONTRACT"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Function to print section header
section() {
  echo ""
  echo -e "${BLUE}═══ $1 ═══${NC}"
}

# Function to check result
check() {
  local name="$1"
  local result=$2

  if [ $result -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} $name"
    ((PASSED++))
    return 0
  else
    echo -e "  ${RED}✗${NC} $name"
    ((FAILED++))
    return 1
  fi
}

# Function to warn
warn() {
  local name="$1"
  echo -e "  ${YELLOW}⚠${NC} $name"
  ((WARNINGS++))
}

#
# Check 1: Git Status
#
section "Git Status"

# Check for uncommitted changes
if git diff --quiet && git diff --cached --quiet; then
  check "No uncommitted changes" 0
else
  echo -e "  ${RED}✗${NC} Uncommitted changes detected"
  echo ""
  echo "  Modified files:"
  git status --short | sed 's/^/    /'
  echo ""
  echo -e "  ${YELLOW}Recommendation:${NC} Commit or stash changes before deploying"
  ((FAILED++))
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  warn "Deploying from main/master branch"
  echo "    Consider using a deployment branch"
else
  check "On feature/deployment branch: $CURRENT_BRANCH" 0
fi

#
# Check 2: Network Validation
#
section "Network Validation"

# Check if mainnet
IS_MAINNET=0
for mainnet in "${MAINNET_NETWORKS[@]}"; do
  if [[ "$NETWORK" == "$mainnet" ]]; then
    IS_MAINNET=1
    break
  fi
done

if [ $IS_MAINNET -eq 1 ]; then
  echo -e "  ${RED}⚠  MAINNET DEPLOYMENT DETECTED${NC}"
  echo ""
  echo "  This is a production deployment with REAL funds at risk."
  echo ""
  read -p "  Type the network name '$NETWORK' to confirm: " CONFIRM

  if [ "$CONFIRM" != "$NETWORK" ]; then
    echo -e "\n  ${RED}✗${NC} Deployment cancelled - confirmation failed"
    exit 1
  fi

  check "Mainnet deployment confirmed" 0
else
  check "Testnet deployment: $NETWORK" 0
fi

#
# Check 3: Environment Configuration
#
section "Environment Configuration"

# Check for required environment variables
if [ -f ".env" ]; then
  check ".env file exists" 0
else
  warn ".env file not found"
  echo "    Deployment may fail if environment variables not set"
fi

# Check for network-specific RPC URL
RPC_VAR=$(echo "${NETWORK}_RPC_URL" | tr '[:lower:]' '[:upper:]')
if [ -n "${!RPC_VAR}" ]; then
  check "RPC URL configured: $RPC_VAR" 0
else
  echo -e "  ${RED}✗${NC} RPC URL not configured: $RPC_VAR"
  echo "    Set with: export $RPC_VAR=<rpc_url>"
  ((FAILED++))
fi

# Check for private key (warn if using PRIVATE_KEY in env)
if [ -n "$PRIVATE_KEY" ]; then
  warn "PRIVATE_KEY found in environment"
  echo "    Consider using hardware wallet or keystore file"
fi

#
# Check 4: Smart Contract Compilation
#
section "Smart Contract Compilation"

if command -v forge &> /dev/null; then
  echo "  Compiling contracts..."
  if forge build --silent; then
    check "Contracts compile successfully" 0
  else
    echo -e "  ${RED}✗${NC} Compilation failed"
    echo "    Run: forge build"
    ((FAILED++))
  fi
else
  warn "Foundry not found, skipping compilation check"
fi

#
# Check 5: Test Coverage
#
section "Test Coverage"

if command -v forge &> /dev/null; then
  echo "  Checking test coverage..."

  # Run coverage (suppress output)
  COVERAGE_JSON=$(forge coverage --json 2>/dev/null || echo "{}")

  if echo "$COVERAGE_JSON" | jq -e . >/dev/null 2>&1; then
    # Extract coverage percentage
    COVERAGE=$(echo "$COVERAGE_JSON" | jq -r '.coverage.lines.pct // 0' 2>/dev/null || echo "0")
    COVERAGE_INT=$(echo "$COVERAGE" | cut -d. -f1)

    if [ "$COVERAGE_INT" -ge "$REQUIRED_COVERAGE" ]; then
      check "Test coverage: $COVERAGE% (>= $REQUIRED_COVERAGE%)" 0
    else
      echo -e "  ${RED}✗${NC} Test coverage: $COVERAGE% (required: >= $REQUIRED_COVERAGE%)"
      echo "    Write more tests to achieve required coverage"
      ((FAILED++))
    fi
  else
    warn "Could not determine test coverage"
  fi
else
  warn "Foundry not found, skipping coverage check"
fi

#
# Check 6: Security Audit
#
section "Security Audit"

# Check if Slither is available
if command -v slither &> /dev/null; then
  echo "  Running Slither analysis..."

  # Run Slither
  SLITHER_OUTPUT=$(slither . --json - 2>/dev/null || echo '{"success": false}')

  if echo "$SLITHER_OUTPUT" | jq -e '.success' >/dev/null 2>&1; then
    # Count critical/high issues
    CRITICAL_COUNT=$(echo "$SLITHER_OUTPUT" | jq '[.results.detectors[] | select(.impact=="High" or .impact=="Critical")] | length' 2>/dev/null || echo "0")

    if [ "$CRITICAL_COUNT" -eq 0 ]; then
      check "No critical/high security issues found" 0
    else
      echo -e "  ${RED}✗${NC} Found $CRITICAL_COUNT critical/high security issues"
      echo "    Review issues with: slither ."
      ((FAILED++))
    fi
  else
    warn "Slither analysis could not complete"
  fi
else
  warn "Slither not found, skipping security audit"
  echo "    Install with: pip install slither-analyzer"
fi

#
# Check 7: Gas Price (if network specified)
#
section "Gas Price Check"

if [ -f ".claude/scripts/gas-monitor.ts" ]; then
  echo "  Checking current gas prices..."

  if .claude/scripts/gas-monitor.ts check "$NETWORK" 2>/dev/null; then
    GAS_PRICE=$(.claude/scripts/gas-monitor.ts current "$NETWORK" 2>/dev/null || echo "unknown")
    check "Gas price acceptable: $GAS_PRICE gwei" 0
  else
    GAS_PRICE=$(.claude/scripts/gas-monitor.ts current "$NETWORK" 2>/dev/null || echo "unknown")
    warn "Gas price high: $GAS_PRICE gwei"
    echo "    Consider waiting for lower gas prices"
    echo "    Run: .claude/scripts/gas-monitor.ts wait $NETWORK"
  fi
else
  warn "Gas monitor not found, skipping gas check"
fi

#
# Check 8: Deployment State
#
section "Deployment State"

DEPLOYMENT_FILE=".claude/context/DEPLOYMENT_STATE.md"
if [ -f "$DEPLOYMENT_FILE" ]; then
  # Check if already deployed to this network
  if grep -q "$NETWORK" "$DEPLOYMENT_FILE"; then
    warn "Previous deployment found for $NETWORK"
    echo "    This may be a re-deployment or upgrade"
  else
    check "No previous deployment for $NETWORK" 0
  fi
else
  warn "DEPLOYMENT_STATE.md not found"
fi

#
# Check 9: Contract Verification Settings
#
section "Contract Verification"

# Check for Etherscan API key (if mainnet)
if [ $IS_MAINNET -eq 1 ]; then
  if [ -n "$ETHERSCAN_API_KEY" ]; then
    check "Etherscan API key configured" 0
  else
    warn "Etherscan API key not set"
    echo "    Contract verification may fail"
    echo "    Set with: export ETHERSCAN_API_KEY=<key>"
  fi
fi

#
# Check 10: Disk Space
#
section "System Resources"

# Check available disk space (require at least 1GB)
AVAILABLE_KB=$(df . | tail -1 | awk '{print $4}')
AVAILABLE_MB=$((AVAILABLE_KB / 1024))

if [ $AVAILABLE_MB -gt 1000 ]; then
  check "Sufficient disk space: ${AVAILABLE_MB}MB available" 0
else
  warn "Low disk space: ${AVAILABLE_MB}MB available"
  echo "    Consider freeing up space before deployment"
fi

#
# Summary
#
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Summary                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASSED checks"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS checks"
echo -e "  ${RED}Failed:${NC}   $FAILED checks"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed - deployment can proceed${NC}"
  echo ""

  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠  Review warnings above before deploying${NC}"
  fi

  if [ $IS_MAINNET -eq 1 ]; then
    echo ""
    echo -e "${RED}REMINDER: This is a MAINNET deployment${NC}"
    echo -e "${RED}         Real funds are at risk${NC}"
    echo ""
  fi

  exit 0
else
  echo -e "${RED}✗ Deployment blocked - fix failures above${NC}"
  echo ""

  if [ $IS_MAINNET -eq 1 ]; then
    echo -e "${RED}CRITICAL: Never deploy to mainnet with failures${NC}"
  fi

  exit 1
fi
