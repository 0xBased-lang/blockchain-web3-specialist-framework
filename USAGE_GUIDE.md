# Web3 Debugging Framework - Complete Usage Guide

## 🚀 Quick Start

### First Time Setup (5 minutes)

1. **Install MCP Servers** (for enhanced capabilities):
```bash
# Context7 provides up-to-date documentation
npm install -g @upleveled/context7

# Brave Search for web queries (optional)
npm install -g @modelcontextprotocol/server-brave-search
```

2. **Set Environment Variables** (optional, for Brave Search):
```bash
export BRAVE_API_KEY="your_brave_api_key_here"
```

3. **Initialize Architecture Map**:
```bash
node .claude/scripts/architecture-mapper.js
```

This scans your project and creates `.claude/debug/architecture-map.json`

---

## 🐛 Using the Debugger

### Method 1: Interactive Debugging (Recommended)

When you encounter a bug, simply invoke the skill:

```
/debug
```

Or if the skill doesn't auto-invoke, paste this into Claude Code:

```
I need to debug an issue. Please use the web3-debugger skill to help me investigate.
```

### What Happens Next:

The framework will **ask you 5 questions** to understand your issue:

#### Question 1: Issue Category
```
What type of issue are you experiencing?

A) Smart contract bug or transaction failure
B) Frontend-backend integration issue
C) Wallet connection or signing problem
D) API/Database synchronization issue
E) Deployment or configuration problem
F) Package/dependency conflict
G) Multi-chain state management issue
H) Other (please describe)

👉 Your answer:
```

**Example answer:** `B - My frontend shows stale data after a transaction`

---

#### Question 2: Environment & Network
```
Which environment and network is this occurring in?

Environment:
- Local development
- Testnet deployment
- Production (mainnet)

Network (if applicable):
- EVM chain (Ethereum, Polygon, BSC, etc.)
- Solana (mainnet-beta, devnet, testnet)
- Multiple chains

👉 Your answer:
```

**Example answer:** `Local development, EVM (Polygon testnet)`

---

#### Question 3: Severity & Urgency
```
How critical is this issue?

🔴 CRITICAL - Production is down, users affected
🟡 HIGH - Blocking development, cannot proceed
🟠 MEDIUM - Workaround available, should fix soon
🟢 LOW - Optimization, cleanup, nice-to-have

👉 Your answer:
```

**Example answer:** `HIGH - Blocking my development`

---

#### Question 4: Specific Details
```
Please provide:
- Which layers are involved? (Frontend, Backend, Blockchain, Cache)
- What's the expected behavior?
- What's the actual behavior?
- Any error messages in console/logs?

👉 Your answer:
```

**Example answer:**
```
Layers: Frontend + Redis cache
Expected: After successful transaction, balance updates immediately
Actual: Balance shows old value until page refresh
Error: No errors, just stale data
```

---

#### Question 5: Context & History
```
A few more details:
- When did this start? (Just now, after a change, always been broken)
- Did anything change recently?
- Does it happen consistently?
- Any troubleshooting steps tried?

👉 Your answer:
```

**Example answer:**
```
Started after I added Redis caching yesterday
Changed: Added Redis.get for balance queries
Consistent: Yes, happens every time
Tried: Clearing cache manually works, but not automatic
```

---

### After Questions: Investigation

The framework will:

1. **Present Investigation Plan**
   ```
   Based on your answers, here's my investigation plan:

   I will analyze:
   1. Frontend state management (React hooks, queries)
   2. Redis cache invalidation logic
   3. Transaction confirmation handling

   Shall I proceed? (yes/no)
   ```

2. **Spawn Parallel Subagents** (if you approve)
   - Frontend Analyzer
   - Backend/Cache Analyzer
   - Blockchain/RPC Analyzer

3. **Present Findings**
   ```
   🔍 Investigation Complete

   Root Cause: Cache not invalidated after transaction

   Frontend: ✅ Transaction succeeds, state updates
   Cache: ❌ Redis key not deleted after tx confirmation
   Blockchain: ✅ Transaction confirmed on-chain

   The issue: After tx.wait(), the frontend updates local state
   but doesn't invalidate the Redis cache key. Next read gets stale data.
   ```

4. **Propose Fix Options**
   ```
   Option A: Quick Fix (5 min)
   Add cache invalidation after transaction

   Option B: Comprehensive Fix (15 min)
   Event-driven cache invalidation with retry logic

   My recommendation: Option A for now, Option B for long-term

   Which do you prefer? (A/B)
   ```

5. **Show Diffs Before Applying**
   ```
   📝 Proposed change to src/hooks/useBalance.ts:

   + // Invalidate cache after transaction
   + await redis.del(`balance:${address}`);
   + queryClient.invalidateQueries(['balance', address]);

   Apply this change? (yes/no/modify)
   ```

6. **Verify After Each Change**
   ```
   ✓ ESLint: Pass
   ✓ TypeScript: Pass
   ✓ Tests: 15/15 passing
   ✓ Build: Successful

   Commit this fix? (yes/no)
   ```

---

## 🛠️ Advanced Usage

### Method 2: Run Validators Manually

You can run validators independently for quick checks:

```bash
# Run all validators
node .claude/scripts/run-all-validators.js

# Run specific validator
node .claude/scripts/validators/integration-validator.js
node .claude/scripts/validators/package-validator.js
```

**Output:**
```
📦 PACKAGE VALIDATION REPORT
Total issues: 3
Critical: 1, High: 0, Medium: 2, Low: 0

Issues:
1. [CRITICAL] Missing lock file - Run npm install
2. [MEDIUM] ethers@^6.0.0 should use exact version
3. [MEDIUM] @solana/web3.js@^1.87.0 should use exact version
```

### Method 3: Programmatic Usage

```javascript
const { IntegrationValidator } = require('./.claude/scripts/validators/integration-validator');

const validator = new IntegrationValidator();
const report = await validator.validate();

console.log(`Found ${report.summary.totalIssues} issues`);
console.log(`Critical: ${report.summary.bySeverity.critical}`);
```

---

## 📊 Understanding Validation Results

### Issue Severity Levels

| Severity | Meaning | Action Required |
|----------|---------|-----------------|
| 🔴 **Critical** | Production down, security vulnerability | Fix immediately |
| 🟠 **High** | Blocks development, likely to cause bugs | Fix before deploying |
| 🟡 **Medium** | Should fix, but workaround exists | Fix soon |
| 🟢 **Low** | Nice-to-have, optimization | Fix when convenient |
| ℹ️ **Info** | Informational, no action needed | Awareness only |

### Common Issue Categories

**Integration Issues:**
- `frontend-backend-sync` - API calls, error handling, loading states
- `frontend-blockchain-sync` - Transaction confirmations, event listeners
- `backend-blockchain-sync` - RPC error handling, event indexing
- `cache-invalidation` - Missing cache deletes after mutations
- `network-configuration` - Chain ID mismatches, hardcoded values
- `transaction-confirmations` - Missing wait(), wrong commitment levels
- `event-listeners` - Missing cleanup, memory leaks
- `race-conditions` - Parallel async, unmounted components
- `abi-versions` - Frontend ABI vs deployed contract mismatch

**Package Issues:**
- `security` - npm audit vulnerabilities, missing lock file
- `dependency-management` - Version conflicts, flexible versions
- `package-management` - Lock file integrity, outdated packages

---

## 🎯 Real-World Examples

### Example 1: Transaction Success But UI Not Updating

**Your Input:**
```
Issue: Frontend-backend integration
Environment: Local, EVM (Polygon)
Severity: High
Details: Transaction succeeds but balance doesn't update
Context: Just added Upstash Redis caching
```

**Framework Output:**
```
Root Cause: Cache invalidation missing after tx.wait()

Fix: Add to src/hooks/useTransaction.ts:
```
```typescript
const receipt = await tx.wait();
await redis.del(`balance:${address}`); // Add this
queryClient.invalidateQueries(['balance']);
```

**Result:** Fixed in 3 minutes (vs 30+ minutes manual debugging)

---

### Example 2: Wrong Network Transaction

**Your Input:**
```
Issue: Transaction sent to wrong network
Environment: Testnet but tx went to mainnet
Severity: Critical
Details: User wallet on mainnet, app expects testnet
```

**Framework Output:**
```
Root Cause: Missing network validation before transaction

Fix: Add to components/SendTransaction.tsx:
```
```typescript
const { chain } = useNetwork();
const REQUIRED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID);

if (chain?.id !== REQUIRED_CHAIN_ID) {
  switchNetwork?.(REQUIRED_CHAIN_ID);
  return; // Don't proceed with wrong network
}
```

**Result:** Prevented potential mainnet transaction with testnet intent

---

### Example 3: Solana Transaction Not Confirming

**Your Input:**
```
Issue: Solana transaction appears successful but not confirmed
Environment: Devnet
Severity: High
Details: sendTransaction returns signature but confirmTransaction fails
```

**Framework Output:**
```
Root Cause: Missing commitment level in confirmTransaction

Fix: Change in src/utils/solana.ts:
```
```typescript
- await connection.confirmTransaction(signature);
+ await connection.confirmTransaction(signature, 'confirmed');
```

**Result:** Transactions now properly confirmed

---

## 🔧 Customization

### Adjust Validation Sensitivity

Edit `.claude/skills/web3-debugger/SKILL.md` to change behavior:

```markdown
## Configuration

Auto-fix level: always_ask (options: always_ask, auto_fix_low, show_diffs)
Verbosity: detailed (options: detailed, concise, minimal)
Risk tolerance: conservative (options: conservative, balanced, aggressive)
```

### Add Custom Validation Rules

Create custom validator in `.claude/scripts/validators/custom-validator.js`:

```javascript
class CustomValidator {
  async validate() {
    // Your custom validation logic
  }
}
```

Add to `run-all-validators.js`:
```javascript
const { CustomValidator } = require('./validators/custom-validator.js');
validators.push({ name: 'custom', Validator: CustomValidator });
```

---

## 🆘 Troubleshooting

### "Skill not found" or `/debug` doesn't work

**Solution:** The skill file must be in the correct location:
```
.claude/skills/web3-debugger/SKILL.md
```

Verify with: `ls -la .claude/skills/web3-debugger/SKILL.md`

---

### "Architecture map not found"

**Solution:** Run the mapper first:
```bash
node .claude/scripts/architecture-mapper.js
```

---

### "MCP servers not available"

**Solution:** Ensure `.mcp.json` exists in project root:
```bash
ls -la .mcp.json
```

MCP servers are optional but enhance the framework's capabilities.

---

### Validators find too many issues

**Solution:** This is normal for first run! Prioritize by severity:
1. Fix all **Critical** issues first
2. Then **High** severity
3. **Medium** can wait
4. **Low** are optional improvements

---

## 📚 File Locations Reference

```
project-root/
├── .claude/
│   ├── skills/
│   │   └── web3-debugger/
│   │       ├── SKILL.md              # Main debugging skill
│   │       ├── references/           # Reference docs
│   │       ├── templates/            # Code templates
│   │       └── scripts/              # Helper scripts
│   ├── scripts/
│   │   ├── architecture-mapper.js    # Project structure detector
│   │   ├── run-all-validators.js     # Master validator runner
│   │   └── validators/
│   │       ├── integration-validator.js
│   │       └── package-validator.js
│   ├── debug/
│   │   ├── architecture-map.json     # Auto-generated project map
│   │   ├── integration-validator-results.json
│   │   ├── package-validator-results.json
│   │   ├── aggregate-validation.json
│   │   ├── patterns/                 # Common issue patterns
│   │   └── sessions/                 # Debugging session logs
│   ├── analysis/                     # Cached analysis
│   └── snapshots/                    # File snapshots for rollback
├── .mcp.json                         # MCP server configuration
├── CLAUDE.md                         # Project intelligence document
└── USAGE_GUIDE.md                    # This file
```

---

## 🎓 Tips for Effective Debugging

### 1. **Be Specific in Answers**

❌ Bad: "It doesn't work"
✅ Good: "Transaction succeeds on blockchain but frontend balance shows old value until page refresh"

### 2. **Provide Error Messages**

Always include:
- Console errors (browser DevTools)
- Terminal errors
- Transaction hashes (if blockchain)
- Contract addresses (if relevant)

### 3. **Describe What Changed**

"This started after I added Redis caching" is VERY helpful context

### 4. **Test Incrementally**

After each fix, verify it works before moving to the next issue

### 5. **Use Architecture Map**

The framework auto-detects your stack. Review `.claude/debug/architecture-map.json` to ensure it detected everything correctly.

---

## 🚀 Next Steps

1. **Try it now:** Type `/debug` and answer the questions
2. **Review findings:** Understand what the validators discovered
3. **Apply fixes:** Approve fixes one at a time, review each diff
4. **Verify:** Ensure tests pass after each fix
5. **Iterate:** Use the framework every time you hit a bug

---

## 📞 Getting Help

If the framework misses an issue or suggests an incorrect fix:

1. **Provide feedback:** "This suggestion didn't work because..."
2. **Add to patterns:** Document the issue in `.claude/debug/patterns/`
3. **Refine the skill:** Edit `.claude/skills/web3-debugger/SKILL.md` to handle similar cases better

The framework learns from your usage and gets better over time!

---

## 🎉 Success Metrics

You'll know the framework is working when:

✅ Debugging time reduced from 30-60 min to 5-10 min
✅ Fewer "mystery bugs" - root causes identified quickly
✅ Consistent code quality across the project
✅ Fewer issues slip into production
✅ Confidence deploying complex Web3 integrations

---

**Happy Debugging! 🐛→✅**
