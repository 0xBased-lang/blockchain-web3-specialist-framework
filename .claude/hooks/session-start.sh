#!/bin/bash
# Session Start Hook for Blockchain Web3 Framework

echo "🚀 Starting Blockchain Web3 Framework Development Session"
echo ""

# Check if local blockchain nodes are running
echo "🔍 Checking local blockchain nodes..."
if ! nc -z localhost 8545 2>/dev/null; then
  echo "  ⚠️  Hardhat node not running on port 8545"
  echo "     Start with: pnpm hardhat node"
else
  echo "  ✅ Hardhat node running on port 8545"
fi

if ! nc -z localhost 8899 2>/dev/null; then
  echo "  ⚠️  Solana validator not running on port 8899"
  echo "     Start with: solana-test-validator"
else
  echo "  ✅ Solana validator running on port 8899"
fi

echo ""

# Check for uncommitted changes
echo "🔍 Checking git status..."
if ! git diff --quiet 2>/dev/null; then
  echo "  ⚠️  You have uncommitted changes:"
  git status --short
else
  echo "  ✅ Working directory clean"
fi

echo ""

# Verify critical dependencies
echo "🔍 Verifying critical tools..."

if ! command -v slither &> /dev/null; then
  echo "  ⚠️  Slither not installed"
  echo "     Install with: pip3 install slither-analyzer"
else
  echo "  ✅ Slither installed"
fi

if ! command -v pnpm &> /dev/null; then
  echo "  ⚠️  pnpm not installed"
  echo "     Install with: npm install -g pnpm"
else
  echo "  ✅ pnpm installed ($(pnpm --version))"
fi

if ! command -v hardhat &> /dev/null && ! [ -f "node_modules/.bin/hardhat" ]; then
  echo "  ⚠️  Hardhat not found"
  echo "     Install with: pnpm add -D hardhat"
else
  echo "  ✅ Hardhat available"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Ready for development"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Documentation:"
echo "   - Architecture: docs/architecture/01-system-architecture.md"
echo "   - Implementation: docs/implementation/ (guides 00-15)"
echo "   - Security: docs/risks/03-corruption-scenarios.md"
echo "   - Optimization: docs/optimization/OPTIMIZATION_RECOMMENDATIONS.md"
echo ""
echo "🔧 Available Commands:"
echo "   /debug <tx_hash> [network]     - Debug failed transactions"
echo "   /deploy <contract> [network]   - Deploy smart contracts"
echo "   /query <natural_language>      - Query blockchain data"
echo "   /analyze <contract> [depth]    - Security analysis"
echo "   /swap <amt> <from> <to> [slippage] - Token swaps"
echo "   /status [detail_level]         - System health check"
echo ""
