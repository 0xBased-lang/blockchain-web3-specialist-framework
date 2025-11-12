#!/bin/bash
# Pre-commit Hook: Secret Detection
#
# Prevents accidental commit of private keys, mnemonics, API keys, and other secrets.
# This is CRITICAL for blockchain projects where private key exposure = fund theft.
#
# Install: ln -s ../../.claude/scripts/detect-secrets.sh .git/hooks/pre-commit
#
# To bypass (DANGEROUS): git commit --no-verify

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Scanning for secrets...${NC}"

# Define secret patterns
declare -A PATTERNS=(
  ["Private Key (CLI)"]='--private-key\s+0x[a-fA-F0-9]{64}'
  ["Private Key (Env)"]='PRIVATE_KEY\s*=\s*["\x27]?0x[a-fA-F0-9]{64}'
  ["Private Key (Raw)"]='0x[a-fA-F0-9]{64}(?!.*\/\/.*test|.*mock|.*example)'
  ["Mnemonic Phrase"]='(mnemonic|seed\s+phrase)["\x27:\s]+(([a-z]+\s+){11,23}[a-z]+)'
  ["RSA Private Key"]='BEGIN\s+(RSA\s+)?PRIVATE\s+KEY'
  ["AWS Access Key"]='AKIA[0-9A-Z]{16}'
  ["API Key Generic"]='(api[_-]?key|apikey)["\x27:\s]+[a-zA-Z0-9]{32,}'
  ["Infura Project ID"]='(infura|project)[_-]?(id|key)["\x27:\s]+[a-f0-9]{32}'
  ["Alchemy API Key"]='alch[_-](api[_-]?key|token)["\x27:\s]+[a-zA-Z0-9_-]{32,}'
  ["Etherscan API Key"]='etherscan[_-]?(api[_-]?)?key["\x27:\s]+[A-Z0-9]{34}'
)

# Files to always block
BLOCKED_FILES=(
  ".env"
  ".env.local"
  ".env.production"
  "*.key"
  "*.pem"
  "**/private-keys/*"
  "**/.secret"
  "**/.secrets"
  "**/keystore/*"
)

SECRETS_FOUND=0

# Check for blocked files
echo "Checking for blocked files..."
for pattern in "${BLOCKED_FILES[@]}"; do
  if git diff --cached --name-only --diff-filter=ACM | grep -qE "$pattern"; then
    echo -e "${RED}❌ BLOCKED FILE DETECTED: $pattern${NC}"
    echo -e "   Files matching this pattern should NEVER be committed"
    SECRETS_FOUND=1
  fi
done

# Check staged content for secret patterns
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -n "$STAGED_FILES" ]; then
  echo "Scanning staged file contents..."

  for name in "${!PATTERNS[@]}"; do
    pattern="${PATTERNS[$name]}"

    # Use git diff to check only staged changes
    if git diff --cached --diff-filter=ACM | grep -P -i "$pattern" > /dev/null; then
      echo -e "${RED}❌ SECRET DETECTED: $name${NC}"
      echo -e "   Pattern: ${pattern:0:50}..."

      # Show context (with secret partially redacted)
      git diff --cached --diff-filter=ACM | grep -P -i -B2 -A2 "$pattern" | \
        sed -E 's/0x[a-fA-F0-9]{60}[a-fA-F0-9]{4}/0x...REDACTED.../g' | \
        sed -E 's/[a-zA-Z0-9]{28}[a-zA-Z0-9]{4}/...REDACTED.../g' | \
        head -10

      SECRETS_FOUND=1
    fi
  done
fi

# Additional heuristic checks
echo "Running heuristic checks..."

# Check for high-entropy strings (potential keys)
HIGH_ENTROPY=$(git diff --cached --diff-filter=ACM | \
  grep -Po '([a-zA-Z0-9+/]{40,}={0,2})' | \
  awk 'length($0) > 50' | \
  head -5)

if [ -n "$HIGH_ENTROPY" ]; then
  echo -e "${YELLOW}⚠️  HIGH-ENTROPY STRINGS DETECTED${NC}"
  echo -e "   These may be encoded secrets (base64, etc.):"
  echo "$HIGH_ENTROPY" | sed 's/\(.\{30\}\).*/\1.../' | sed 's/^/   /'
  echo ""
  echo -e "   ${YELLOW}If these are NOT secrets, you can proceed.${NC}"
  echo -e "   ${YELLOW}If they ARE secrets, remove them before committing.${NC}"
fi

# Check for common test/mock patterns that are safe
SAFE_INDICATORS=$(git diff --cached --diff-filter=ACM | \
  grep -i -c 'test\|mock\|example\|placeholder\|dummy' || true)

if [ "$SAFE_INDICATORS" -gt 0 ] && [ "$SECRETS_FOUND" -eq 1 ]; then
  echo -e "${YELLOW}⚠️  Note: Found $SAFE_INDICATORS occurrences of test/mock indicators${NC}"
  echo -e "   ${YELLOW}If the detected secrets are for testing only, they may be safe.${NC}"
fi

# Final decision
if [ "$SECRETS_FOUND" -eq 1 ]; then
  echo ""
  echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  COMMIT BLOCKED: Secrets detected in staged changes   ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}What to do:${NC}"
  echo "  1. Remove the secret from your code"
  echo "  2. Use environment variables instead: process.env.PRIVATE_KEY"
  echo "  3. Add sensitive files to .gitignore"
  echo "  4. If this is a false positive, review carefully"
  echo ""
  echo -e "${YELLOW}To bypass this check (DANGEROUS):${NC}"
  echo "  git commit --no-verify"
  echo ""
  echo -e "${RED}⚠️  Committed secrets cannot be easily removed from git history!${NC}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ No secrets detected - commit allowed${NC}"
exit 0
