# Complete Debugging Workflow

## Step-by-Step Guide

### 1. Initial Setup (One-Time)

```bash
# Map your project architecture
node .claude/scripts/architecture-mapper.js

# This creates .claude/debug/architecture-map.json
# The framework now understands your project structure
```

### 2. When You Hit a Bug

**Option A: Use the Interactive Skill (Recommended)**
```
Open Claude Code and type:
/debug
```

The framework will ask you 5 questions:
1. Issue category (smart contract, frontend-backend, wallet, etc.)
2. Environment & network (local, testnet, mainnet)
3. Severity (critical, high, medium, low)
4. Specific details (layers involved, expected vs actual behavior)
5. Context & history (when it started, what changed)

After answering, the framework will:
- Analyze all relevant layers
- Identify root cause
- Propose fix options
- Show diffs before applying
- Verify fixes work

**Option B: Run Validators Manually**

```bash
# Run all validators to find issues
node .claude/scripts/run-all-validators.js

# This runs:
# - Integration Validator (frontend-backend-blockchain sync)
# - Package Validator (dependencies, security)
# - Quality Validator (ESLint, TypeScript, Prettier)
# - Git Validator (uncommitted changes, branch status)
# - Contract Validator (Slither, Foundry, gas analysis)
# - Deployment Validator (Vercel config, env vars)
# - Observability Validator (console errors, Playwright)

# Output: .claude/debug/aggregate-validation.json
```

### 3. Review Validation Results

```bash
# View the aggregate report
cat .claude/debug/aggregate-validation.json

# Or view SARIF output (industry standard format)
cat .claude/debug/results.sarif
```

The report shows:
- Total issues by severity
- Issues grouped by category
- Top 10 issues to fix first
- Specific files and line numbers

### 4. Apply Automated Fixes (Optional)

```bash
# DRY-RUN first (preview changes)
node .claude/scripts/fix-engine.js

# This shows what would be fixed without applying changes

# If you approve, apply the fixes
node .claude/scripts/fix-engine.js --apply
```

Automated fixes include:
- Running ESLint --fix
- Running Prettier --write
- Generating missing files (.gitignore, .env.example)
- Adding transaction confirmation waits
- Adding cache invalidation
- Adding error logging to empty catch blocks

### 5. Create a Savepoint (Before Manual Fixes)

```bash
# Create a git commit + file snapshots
node .claude/scripts/rollback-system.js create "Before manual fixes"

# Output: savepoint_xyz123
```

This allows you to rollback if something goes wrong.

### 6. Make Manual Fixes

For issues that can't be auto-fixed, make changes manually using the reference templates:

- **Transaction handling**: `.claude/skills/web3-debugger/templates/transaction-handling.md`
- **Cache strategies**: `.claude/skills/web3-debugger/templates/cache-strategies.md`
- **Error handling**: `.claude/skills/web3-debugger/templates/error-handling.md`

### 7. Verify Fixes

```bash
# Run verification pipeline
node .claude/scripts/verification-pipeline.js

# This runs:
# - ESLint
# - TypeScript compiler
# - Tests (frontend + contracts)
# - Build

# Output: .claude/debug/verification-results.json
```

If verification fails:
```bash
# Rollback to savepoint
node .claude/scripts/rollback-system.js list
node .claude/scripts/rollback-system.js rollback savepoint_xyz123
```

### 8. Re-run Validators

```bash
# Verify issues are resolved
node .claude/scripts/run-all-validators.js

# Compare before/after issue counts
```

### 9. Commit and Deploy

```bash
# If all checks pass, commit your fixes
git add .
git commit -m "fix: resolve integration bugs [fixes #123]"

# Push to deploy
git push origin your-branch
```

## Real-World Example

### Scenario: Transaction Success but UI Not Updating

**Step 1: Describe to /debug skill**
```
You: "Transaction succeeds but balance doesn't update until page refresh"

Skill asks:
Q1: Issue category?
You: "B - Frontend-backend integration"

Q2: Environment?
You: "Local development, EVM (Polygon testnet)"

Q3: Severity?
You: "HIGH - Blocking development"

Q4: Details?
You: "Layers: Frontend + Redis cache
Expected: Balance updates immediately after tx
Actual: Balance shows old value until refresh
Error: No errors, just stale data"

Q5: Context?
You: "Started after adding Redis caching yesterday
Changed: Added Redis.get for balance queries
Consistent: Yes, every time
Tried: Manual cache clear works"
```

**Step 2: Framework Investigation**

The framework:
1. Spawns 3 parallel subagents (Frontend Analyzer, Cache Analyzer, Blockchain Analyzer)
2. Finds: Cache invalidation missing after `tx.wait()`
3. Shows root cause with file/line numbers

**Step 3: Framework Proposes Fixes**

```
Option A: Quick fix (5 min)
  Add cache invalidation after transaction

Option B: Comprehensive fix (15 min)
  Event-driven cache invalidation with retry logic

Recommendation: A for now, B for long-term

Which do you prefer? (A/B)
```

**Step 4: You Choose A**

```
Framework shows diff:

📝 Proposed change to src/hooks/useBalance.ts:

+ // Invalidate cache after transaction
+ await redis.del(`balance:${address}`);
+ queryClient.invalidateQueries(['balance', address]);

Apply this change? (yes/no)
```

**Step 5: You Approve**

```
You: yes

Framework:
✓ Applied changes
✓ Running verification...
✓ ESLint: Pass
✓ TypeScript: Pass
✓ Tests: 15/15 passing
✓ Build: Successful

Commit this fix? (yes/no)
```

**Step 6: Commit**

```
You: yes

Framework:
✓ Committed: "fix: add cache invalidation after transaction"
✓ All validators pass
✓ Safe to deploy
```

**Total time: 5 minutes** (vs 30-60 minutes manual debugging)

## Quick Reference Commands

```bash
# Initial setup
node .claude/scripts/architecture-mapper.js

# Find issues
node .claude/scripts/run-all-validators.js

# Preview fixes
node .claude/scripts/fix-engine.js

# Apply fixes
node .claude/scripts/fix-engine.js --apply

# Create savepoint
node .claude/scripts/rollback-system.js create "description"

# List savepoints
node .claude/scripts/rollback-system.js list

# Rollback
node .claude/scripts/rollback-system.js rollback <savepoint-id>

# Verify
node .claude/scripts/verification-pipeline.js

# Quick verification (skip slow tests)
node .claude/scripts/verification-pipeline.js --quick

# Clean old savepoints
node .claude/scripts/rollback-system.js clean 5
```

## Troubleshooting

### "Architecture map not found"
```bash
node .claude/scripts/architecture-mapper.js
```

### "No issues found but I have bugs"
- The issue may be logic-specific, not pattern-based
- Use the `/debug` skill for interactive investigation
- Check `.claude/debug/` for individual validator results

### "Validators taking too long"
- Use `--quick` flag where available
- Check if RPC endpoints are responding
- Review `.claude/debug/patterns/` for what's being checked

### "Fix engine broke something"
```bash
# Rollback to last savepoint
node .claude/scripts/rollback-system.js list
node .claude/scripts/rollback-system.js rollback <savepoint-id>
```

### "Verification fails after fixes"
- Review `.claude/debug/verification-results.json`
- Check specific failures (linting, tests, build)
- Rollback and try manual approach

## Best Practices

1. **Always run architecture mapper first** - Ensures framework knows your stack
2. **Use /debug for complex issues** - Interactive questions lead to faster solutions
3. **Create savepoints before fixes** - Easy rollback if needed
4. **Run validators after every fix** - Verify issues are resolved
5. **Use dry-run before applying fixes** - Preview changes first
6. **Keep validators updated** - Re-run after major changes
7. **Review aggregated results** - Fix critical/high severity first
8. **Use templates for manual fixes** - Proven patterns reduce bugs
9. **Verify before committing** - Run full pipeline
10. **Clean old savepoints** - Keep last 10, delete older ones

## Integration with CI/CD

```yaml
# .github/workflows/validate.yml
name: Web3 Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm install

      - name: Run validators
        run: node .claude/scripts/run-all-validators.js

      - name: Run verification
        run: node .claude/scripts/verification-pipeline.js

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: .claude/debug/results.sarif
```

This runs validators and verification on every push, blocking merges if critical issues exist.
