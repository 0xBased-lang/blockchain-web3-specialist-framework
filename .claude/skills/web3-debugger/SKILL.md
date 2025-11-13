# Web3 Integration Debugger

**CRITICAL: This skill uses INTERACTIVE QUESTIONS as the core methodology. NEVER assume - ALWAYS ask for user confirmation at critical checkpoints.**

## Phase 1: Initial Information Gathering (INTERACTIVE)

Before doing ANY analysis, ask the user these questions ONE AT A TIME, waiting for each response:

### Question 1: Issue Category
"What type of issue are you experiencing? (Please choose one)

A) Smart contract bug or transaction failure
B) Frontend-backend integration issue
C) Wallet connection or signing problem
D) API/Database synchronization issue
E) Deployment or configuration problem
F) Package/dependency conflict
G) Multi-chain state management issue
H) Other (please describe)

👉 Your answer:"

**STOP and wait for response.**

### Question 2: Environment & Network
"Which environment and network is this occurring in?

**Environment:**
- Local development
- Testnet deployment
- Production (mainnet)

**Network (if applicable):**
- EVM chain (Ethereum, Polygon, BSC, etc.)
- Solana (mainnet-beta, devnet, testnet)
- Multiple chains

👉 Your answer:"

**STOP and wait for response.**

### Question 3: Severity & Urgency
"How critical is this issue?

🔴 **CRITICAL** - Production is down, users affected, revenue impact
🟡 **HIGH** - Blocking development, cannot proceed without fix
🟠 **MEDIUM** - Workaround available, should fix soon
🟢 **LOW** - Optimization, cleanup, or nice-to-have improvement

👉 Your answer:"

**STOP and wait for response.**

### Question 4: Specific Details
Based on the issue category from Question 1, ask for relevant details:

**If smart contract/transaction:**
"Please provide:
- Transaction hash (if failed transaction)
- Contract address (if contract issue)
- Error message or revert reason
- What were you trying to do?

👉 Your answer:"

**If integration issue:**
"Please provide:
- Which layers are involved? (Frontend, Backend, Blockchain, Cache)
- What's the expected behavior?
- What's the actual behavior?
- Any error messages in console/logs?

👉 Your answer:"

**If wallet/signing:**
"Please provide:
- Which wallet? (MetaMask, Phantom, WalletConnect, etc.)
- Which network should it be on?
- What's the error message?
- Does wallet show correct network?

👉 Your answer:"

**STOP and wait for response.**

### Question 5: Context & History
"A few more details to help me investigate:

- When did this start happening? (Just now, after a change, always been broken)
- Did anything change recently? (Code, dependencies, configuration, deployment)
- Does it happen consistently or intermittently?
- Have you tried any troubleshooting steps already?

👉 Your answer:"

**STOP and wait for response.**

---

## Phase 2: Investigation Strategy (ASK FOR CONFIRMATION)

Based on the answers above, present an investigation plan:

"Based on your answers, here's my investigation plan:

**Issue Summary:**
- Category: [from Q1]
- Environment: [from Q2]
- Severity: [from Q3]
- Specific issue: [from Q4]

**Investigation Approach:**

I will analyze the following in this order:

1. [First layer to investigate based on issue type]
   - What I'll check: [specific checks]
   - Tools I'll use: [e.g., transaction trace, logs, code review]
   - Estimated time: [X minutes]

2. [Second layer if needed]
   - What I'll check: [specific checks]
   - Tools I'll use: [tools]

3. [Third layer if needed]
   - What I'll check: [specific checks]

**Alternative Approach (if you prefer):**
[Present alternative if applicable]

**Questions before I proceed:**
- Does this investigation plan make sense?
- Should I start with a different area?
- Is there specific context I should know about this project?

👉 Shall I proceed with this plan? (yes/no/modify)"

**⚠️ CHECKPOINT: Wait for user confirmation before proceeding.**

---

## Phase 3: Parallel Investigation (USE SUBAGENTS)

**IMPORTANT:** Only proceed if user approved the plan in Phase 2.

Based on the issue category, spawn the appropriate specialized subagents:

### For Integration Issues (Frontend-Backend-Blockchain)
Spawn 3 parallel subagents:

#### Subagent 1: Frontend Analysis
Task: "Analyze the frontend layer of this integration issue:
- User reported: [issue from Phase 1]
- Check: React component state, Web3 hooks, wallet connections
- Look for: State sync issues, missing event listeners, race conditions
- Use: Read tool to examine components, Grep for patterns
- Return: Summary of frontend issues found with specific file locations"

#### Subagent 2: Backend/Database Analysis
Task: "Analyze the backend and database layer:
- User reported: [issue from Phase 1]
- Check: API endpoints, Supabase queries, Redis cache
- Look for: Database sync issues, cache invalidation, API errors
- Use: Read tool for API routes, check Supabase schema
- Return: Summary of backend issues with specific locations"

#### Subagent 3: Blockchain/RPC Analysis
Task: "Analyze the blockchain interaction layer:
- User reported: [issue from Phase 1]
- Network: [from Phase 1]
- Check: RPC calls, transaction handling, event listening
- Look for: Network mismatch, RPC errors, missing confirmations
- Use: WebFetch for transaction traces (if tx hash provided)
- Return: Summary of blockchain layer issues"

### For Smart Contract Issues
Spawn 2 parallel subagents:

#### Subagent 1: Transaction Analysis
Task: "Analyze the failed transaction:
- Transaction hash: [from Phase 1]
- Network: [from Phase 1]
- Use WebFetch to get transaction details from block explorer
- Use Context7 for latest Web3.js/ethers.js docs if needed
- Identify revert reason, gas issues, or logic errors
- Return: Root cause of transaction failure"

#### Subagent 2: Contract Code Review
Task: "Review the smart contract code:
- Contract address: [from Phase 1]
- Use Read tool to examine contract source
- Check for: Common vulnerabilities, logic errors, access control
- Use CodeRabbit if available for automated review
- Return: Contract issues found with severity ratings"

### For Configuration/Deployment Issues
Spawn 2 parallel subagents:

#### Subagent 1: Configuration Validator
Task: "Validate configuration across environments:
- Check: .env files, vercel.json, network configs
- Compare: local vs production settings
- Look for: Missing env vars, wrong RPC endpoints, network mismatches
- Return: Configuration discrepancies found"

#### Subagent 2: Deployment Validator
Task: "Check deployment status and health:
- Platform: Vercel (frontend), blockchain (contracts)
- Check: Build status, contract verification, API health
- Look for: Build errors, unverified contracts, broken endpoints
- Return: Deployment issues found"

**⏱️ Wait for all subagents to complete (typically 30-60 seconds)**

---

## Phase 4: Synthesis & Diagnosis (PRESENT FINDINGS)

After receiving all subagent reports, synthesize the findings:

"## 🔍 Investigation Complete

I've analyzed the full stack. Here's what I found:

### 🎯 Root Cause
[Clear explanation of the primary issue]

### 📊 Findings by Layer

**Frontend:**
- ✅ [What's working correctly]
- ⚠️ [Warnings or minor issues]
- ❌ [Critical issues found]

**Backend/Database:**
- ✅ [What's working correctly]
- ⚠️ [Warnings or minor issues]
- ❌ [Critical issues found]

**Blockchain/RPC:**
- ✅ [What's working correctly]
- ⚠️ [Warnings or minor issues]
- ❌ [Critical issues found]

### 🔗 Integration Flow Analysis
[Trace the data flow and identify where it breaks]

User Action → [Step 1: ✅] → [Step 2: ✅] → [Step 3: ❌ BREAKS HERE] → [Step 4: never reached]

**Why it breaks at Step 3:**
[Technical explanation]

### 📈 Impact Assessment
- **Severity:** [Critical/High/Medium/Low]
- **Affected users:** [Estimate]
- **Workaround available:** [Yes/No - explain if yes]

### 🤔 Questions for clarification (if needed)
[Ask any follow-up questions to confirm diagnosis]

**⚠️ CHECKPOINT: Do these findings match what you're experiencing? Should I proceed to proposing solutions?**"

**STOP and wait for user confirmation.**

---

## Phase 5: Solution Proposal (PRESENT OPTIONS)

**IMPORTANT:** Only proceed if user confirmed the diagnosis.

Present fix options with trade-offs:

"## 💡 Solution Options

I've identified [X] potential fixes. Here are your options:

### Option A: [Quick Fix] (Recommended for immediate resolution)
**What it does:**
[Explain the fix in plain language]

**Changes required:**
- File 1: [brief description of change]
- File 2: [brief description of change]

**Pros:**
- ✅ Fast to implement (X minutes)
- ✅ Low risk
- ✅ Solves immediate problem

**Cons:**
- ⚠️ [Any limitations or trade-offs]

**Testing required:**
- [What tests need to run]

---

### Option B: [Comprehensive Fix] (Recommended for long-term solution)
**What it does:**
[Explain the fix in plain language]

**Changes required:**
- File 1: [brief description]
- File 2: [brief description]
- Additional: [any new tests, config changes]

**Pros:**
- ✅ Addresses root cause
- ✅ Prevents similar issues
- ✅ Improves overall architecture

**Cons:**
- ⚠️ Takes longer (X minutes)
- ⚠️ More extensive testing needed

**Testing required:**
- [Comprehensive test list]

---

### Option C: [Alternative approach, if applicable]
[Present if there's a significantly different approach]

---

## 🤝 My Recommendation

I recommend **Option [A/B/C]** because [reasoning based on severity, urgency, and context].

**Questions:**
1. Which option would you prefer?
2. Should I show you the code changes before applying them?
3. Any concerns or questions about the proposed fixes?

👉 Your choice (A/B/C or 'show me more details first'):"

**⚠️ CHECKPOINT: Wait for user to choose an option.**

---

## Phase 6: Fix Application (WITH SAFETY MEASURES)

**IMPORTANT:** Only proceed if user selected an option.

### Step 1: Create Safety Checkpoint
"## 🛡️ Safety Checkpoint

Before making any changes, I'm creating a safety checkpoint:

✅ Creating git commit of current state...
✅ Creating snapshot in .claude/snapshots/...
✅ Tagging as 'pre-fix-[timestamp]'

**Rollback available if needed:** You can always revert to this exact state.

Proceeding to dry-run..."

### Step 2: Dry-Run Mode (MANDATORY)
For EACH file that needs changes:

"## 📝 Dry-Run: Proposed Changes to [filename]

**File:** `[filepath]`
**Type of change:** [Bug fix / Feature / Refactor / Config]
**Risk level:** [🟢 Low / 🟡 Medium / 🔴 High]

**What this changes:**
[Explain in plain language what the code does differently]

**Diff preview:**
```diff
[Show the actual diff with - and + lines]
```

**Why this fixes the issue:**
[Explanation of how this change addresses the problem]

**Potential side effects:**
[Any areas that might be affected]

**⚠️ CHECKPOINT: Apply this change?**
- **yes** - Apply this change
- **no** - Skip this change
- **modify** - I want to adjust this
- **abort** - Stop all changes

👉 Your choice:"

**STOP and wait for confirmation for EACH file.**

### Step 3: Apply Change (Only if approved)
"✅ Applying change to [filename]...
✅ Change applied successfully.

Running verification..."

### Step 4: Verification Pipeline
After applying the change:

"## 🧪 Verification

**Stage 1: Static Analysis**
- Running ESLint... [✅ Pass / ❌ Fail]
- Running TypeScript check... [✅ Pass / ❌ Fail]
- Running Prettier... [✅ Pass / ❌ Fail]

**Stage 2: Unit Tests**
- Running relevant unit tests... [✅ Pass / ❌ Fail]
- [Show any test failures if they occur]

**Stage 3: Build**
- Building project... [✅ Pass / ❌ Fail]

---

**⚠️ VERIFICATION RESULT: [All Passed / Some Failed]**

[If failures occurred:]
**Failures detected:**
1. [Test name]: [error message]
2. [Build error]: [error message]

**Options:**
A) Rollback this change (recommended if unexpected failures)
B) Fix the verification failures
C) Continue anyway (not recommended)

👉 What would you like to do?"

**⚠️ CHECKPOINT: Wait for decision if there are failures.**

### Step 5: Cascading Impact Check
"## 🔍 Checking for unintended side effects...

Running FULL test suite to ensure this fix didn't break anything else...

**Full test results:**
- Total tests: [X]
- Passed: [Y] ✅
- Failed: [Z] ❌
- Skipped: [W]

[If any unexpected failures:]
**⚠️ WARNING: This fix may have affected other areas:**
[List affected areas with file:line references]

**Recommendation:**
[Suggest rollback or additional fixes]

**⚠️ CHECKPOINT: Continue with this fix or rollback?"

**STOP and wait if there are unexpected failures.**

### Step 6: Commit Changes (If all verified)
"## ✅ All verifications passed!

**Summary of changes:**
- Files modified: [list]
- Tests passing: [count]
- Build: Successful

**Creating commit:**
- Message: `fix: [description based on the issue]`
- Files staged: [list]

**⚠️ FINAL CHECKPOINT: Commit these changes?**

👉 Your choice (yes/no):"

**STOP and wait for final confirmation.**

---

## Phase 7: Post-Fix Verification & Monitoring

After successful fix:

"## 🎉 Fix Applied Successfully!

**What was changed:**
[Summary of all changes made]

**Git commit:**
- SHA: [commit hash]
- Message: [commit message]
- You can view diff with: `git show [hash]`

---

## 🧪 Recommended Next Steps

**1. Manual Testing:**
[Provide specific test scenarios based on the fix]

**Example:**
- [ ] Test [specific user flow]
- [ ] Verify [specific state/data]
- [ ] Check [specific integration point]

**2. Monitoring (if production):**
- [ ] Watch for errors in Sentry
- [ ] Monitor transaction success rate (if blockchain)
- [ ] Check API response times (if backend)
- [ ] Review Vercel deployment logs

**3. Additional Recommendations:**
[Based on the root cause, suggest preventive measures]

---

## 📚 Prevention Tips

To prevent this issue from recurring:

1. [Specific recommendation based on the issue]
2. [Testing strategy to add]
3. [Configuration or architecture improvement]

**Would you like me to:**
- Create a test case to prevent regression?
- Update documentation with this pattern?
- Add monitoring/alerts for this scenario?
- Create a PR for review?

👉 Your choice:"

---

## 🆘 Rollback Procedure (If Needed at Any Point)

If something goes wrong at ANY stage:

"## ⚠️ ROLLBACK INITIATED

**Reason:** [Why rollback was triggered]

**Restoring to checkpoint:** pre-fix-[timestamp]

**Method:** [Git reset / Snapshot restore]

**Status:**
✅ Files restored
✅ Git history clean
✅ Snapshot verified

**You are now back to the state before any changes.**

**What would you like to do now:**
A) Try a different fix approach
B) Investigate the issue further
C) End debugging session

👉 Your choice:"

---

## 🔧 Error Handling at Each Phase

### If Subagents Fail
"⚠️ One of my analysis agents encountered an issue:
- Agent: [which one]
- Error: [error message]

**I can:**
A) Retry the analysis
B) Continue with partial findings from other agents
C) Try a different investigation approach

👉 What would you prefer?"

### If Tools Fail (CodeRabbit, Context7, etc.)
"⚠️ External tool unavailable:
- Tool: [name]
- Error: [message]

**Fallback:** I'll proceed using alternative methods:
[Explain alternative approach]

**Continue? (yes/no)"

### If User Context is Unclear
"⚠️ I need more information to proceed:

I'm not clear on: [specific question]

Could you clarify:
[Specific question]

This will help me [why it's important]"

---

## 📊 Session Summary (At the end)

"## 📊 Debugging Session Summary

**Session ID:** [timestamp]
**Duration:** [X minutes]
**Status:** [✅ Resolved / ⚠️ Partially Resolved / ❌ Needs More Investigation]

---

### 🎯 Original Issue
[Brief description from Phase 1]

---

### 🔍 Root Cause Identified
[What was actually wrong]

---

### ✅ Fixes Applied
1. [File / Area]: [What was changed]
2. [File / Area]: [What was changed]

---

### 🧪 Verification Results
- Static analysis: ✅ Passed
- Unit tests: ✅ Passed [X/Y]
- Integration tests: ✅ Passed [X/Y]
- Build: ✅ Successful

---

### 📝 Commits Created
- [commit hash]: [message]

---

### 📚 Recommendations
1. [Preventive measure]
2. [Testing to add]
3. [Architecture improvement]

---

### 💾 Session Saved To
- `.claude/debug/sessions/[timestamp].json`

**You can reference this session later for similar issues.**

---

**Any other questions or concerns about this fix?**"

---

## 💡 Special Handling for Multi-Chain Issues

If the issue involves EVM vs Solana differences:

"## 🔗 Multi-Chain Context Detected

**Important:** This project supports both EVM and Solana chains.

**Clarification needed:**
Which chain is this issue related to?
- EVM (Ethereum, Polygon, etc.)
- Solana
- Both (cross-chain issue)

**Different approaches for each:**

**EVM:**
- Tools: Foundry, Hardhat, ethers.js
- Transaction structure: [EVM-specific]
- Common issues: [EVM patterns]

**Solana:**
- Tools: Anchor, Solana CLI, @solana/web3.js
- Transaction structure: [Solana-specific]
- Common issues: [Solana patterns]

**Cross-chain:**
- State synchronization between chains
- Different finality models
- Network ID management

👉 Which chain?"

---

## 🎓 Learning from This Session

At the end, offer to update project knowledge:

"## 📖 Update Project Knowledge?

This issue revealed a pattern that might help prevent future bugs.

**I can document this by:**

1. **Adding to CLAUDE.md:**
   - New common issue pattern
   - Best practice for this scenario
   - Testing strategy

2. **Creating reference doc:**
   - `.claude/debug/patterns/[issue-type].md`
   - For future quick reference

3. **Adding automated check:**
   - Create a linting rule
   - Add to CI/CD pipeline

**Would you like me to do any of these?**

👉 Your choice:"

---

## ⚙️ Configuration & Customization

User can customize behavior by setting preferences:

**Auto-fix level:**
- `always_ask`: Confirm every change (default, safest)
- `auto_fix_low`: Auto-fix formatting/docs, ask for code changes
- `show_diffs`: Always show diffs, but don't require confirmation for low-risk

**Verbosity:**
- `detailed`: Show all reasoning and checks (default)
- `concise`: Show only key decisions and results
- `minimal`: Show only critical checkpoints

**Risk tolerance:**
- `conservative`: Multiple checkpoints, extensive verification (default)
- `balanced`: Checkpoints for critical changes only
- `aggressive`: Auto-proceed with verification (not recommended)

---

**END OF SKILL**

This skill implements the interactive question-driven debugging methodology with human checkpoints at every critical decision point. It never assumes, always asks, and provides full transparency throughout the process.
