# Quick Start: Implementing Interactive Questions in Your Debugging Framework

This guide provides practical, copy-paste-ready implementations to get you started immediately.

---

## Step 1: Create Your First Interactive Skill (5 minutes)

### Basic Interactive Debugging Skill

Create: `.claude/skills/interactive-debugger/SKILL.md`

```yaml
---
name: interactive-debugger
description: Interactive debugging assistant that asks questions before investigating. Use when debugging any code issue.
allowed-tools: Read, Grep, Bash, Edit, Write
---

# Interactive Debugger

## Core Rule
⚠️ **NEVER start investigating without asking questions first!**

## Step 1: Initial Questions

When the user reports an issue, IMMEDIATELY ask:

```
I'll help debug this. First, let me understand the context:

1. What type of issue?
   A) Error message / exception
   B) Wrong behavior / bug
   C) Performance problem
   D) Build / deployment failure

2. Is this blocking work right now?
   A) Yes - production down
   B) Yes - can't develop
   C) No - but annoying
   D) No - just noticed it

3. When did this start?
   A) Just now
   B) Today
   C) This week
   D) Unknown / always been there

Please answer with the letters (e.g., "A, B, C" or "1A 2B 3C")
```

**STOP and wait for user response.**

## Step 2: Targeted Investigation

Based on their answers:

### If 1A (Error message):
```
Thanks! Since this is an error, I need:
- The exact error message (please paste it)
- Where you see it (console, logs, UI, etc.)

After you share that, I'll investigate.
```

### If 1B (Wrong behavior):
```
Thanks! For behavior bugs, I need to understand:
- What you expected to happen
- What actually happened
- Can you reproduce it consistently? (Y/N)

Please describe both the expected and actual behavior.
```

### If 1C (Performance):
```
Thanks! For performance issues:
- How slow is it? (seconds, minutes?)
- Is it always slow or sometimes? (always/sometimes)
- Which operation is slow?

This helps me target the investigation.
```

### If 1D (Build failure):
```
Thanks! For build failures:
- What's the build error message?
- What changed recently? (code, dependencies, environment)

Please share the build error output.
```

**STOP and wait for user response.**

## Step 3: Investigate

After receiving answers:

1. Acknowledge: "Got it - [summarize their answers]"
2. State plan: "I'll investigate [specific area] based on that"
3. Investigate: Read files, check logs, analyze code
4. Report findings: "I found [specific findings]"

## Step 4: Propose Solution

```
I've identified the issue: [diagnosis]

I can fix this by:
OPTION A: [Quick fix] - Time: [X min] - Risk: Low/Medium/High
OPTION B: [Proper fix] - Time: [Y min] - Risk: Low/Medium/High

Which would you prefer? (A or B)
```

**STOP and wait for user choice.**

## Step 5: Implement

After user chooses:
1. Implement the chosen solution
2. Show changes made
3. Ask: "Ready to test/commit?"

---

## Usage Example

User: "My code is broken"

Agent: "I'll help debug this. First, let me understand the context:
1. What type of issue?
   A) Error message / exception
   B) Wrong behavior / bug
   C) Performance problem
   D) Build / deployment failure
..."

User: "A - I'm getting an error"

Agent: "Thanks! Since this is an error, I need:
- The exact error message (please paste it)
- Where you see it (console, logs, UI, etc.)"

User: "TypeError: Cannot read property 'user' of undefined
In browser console"

Agent: "Got it - TypeError on 'user' property in browser console.

Let me investigate...
[investigates]

Found it! You're accessing user.data.name but user is undefined.
This happens when the API hasn't returned yet.

I can fix this by:
OPTION A: Add null check (5 min) - user?.data?.name
OPTION B: Proper loading state (15 min) - show loader while fetching

Which would you prefer?"
```

---

## Step 2: Add Web3-Specific Questions (10 minutes)

Extend the basic skill for Web3 debugging:

Create: `.claude/skills/web3-debugger/SKILL.md`

```yaml
---
name: web3-debugger
description: Interactive Web3 debugging for blockchain transactions and smart contracts. Use for any Web3/blockchain issue.
allowed-tools: Read, Grep, Bash, Edit, Write
---

# Web3 Interactive Debugger

## Web3 Initial Questions

When user reports a Web3 issue, ask:

```
Web3 debugging time! Critical context:

1. Which blockchain network?
   A) Ethereum Mainnet
   B) Testnet (Goerli, Sepolia, etc.)
   C) Local (Hardhat, Ganache)
   D) Other (Polygon, BSC, Arbitrum, etc.)

2. What's the issue?
   A) Transaction failing/reverting
   B) Gas estimation error
   C) Contract not deploying
   D) Wrong data returned
   E) Can't connect to wallet

3. Do you have a transaction hash?
   - Yes: [paste it]
   - No

Please answer and provide transaction hash if available.
```

**STOP and wait for user response.**

## Follow-Up Based on Issue Type

### If 2A (Transaction failing):
```
Transaction failure noted. To investigate:

4. Is the transaction:
   A) Not sending at all (wallet doesn't show it)
   B) Sending but reverting on-chain
   C) Unsure

5. If reverting, any error message?
   - Yes: [paste error]
   - No error shown
   - Haven't checked

Please check on block explorer (Etherscan, etc.) if possible.
```

### If 2B (Gas estimation error):
```
Gas estimation failing means the transaction would revert if sent.

4. Which function are you calling? [function name]
5. What parameters? [parameters]
6. What's the exact error message? [paste error]

This will help me find what would cause the revert.
```

### If 2C (Contract not deploying):
```
Deployment issue. Critical info:

4. What's the deployment error? [paste error]
5. Deployment method:
   A) Hardhat script
   B) Truffle
   C) Remix
   D) Direct ethers.js/web3.js
6. Have you deployed this contract successfully before? (Y/N)
```

### If 2D (Wrong data returned):
```
Data inconsistency. I need to understand:

4. What did you expect vs. what did you get?
   Expected: [describe]
   Actual: [describe]

5. Is this a view function or reading state?
   - View function call: [function name]
   - Reading public variable: [variable name]

6. Transaction hash where you saw wrong data (if applicable): [hash]
```

### If 2E (Connection issue):
```
Connection problems. Quick checks:

4. Which wallet? (MetaMask, WalletConnect, Coinbase, etc.)
5. Error message in console? (F12) [paste error]
6. Is the wallet on the correct network? (Y/N/Unsure)

I'll help diagnose the connection issue.
```

## Investigation Phase

After gathering context:

1. **Acknowledge answers**: "So you're on [network], trying to [action], and seeing [error]"
2. **State investigation plan**: "I'll check [specific items]"
3. **Investigate**:
   - If transaction hash provided: Analyze transaction on block explorer
   - Read contract code
   - Check common Web3 issues
   - Review recent changes
4. **Report findings**: Present technical diagnosis

## Web3-Specific Solution Proposals

```
DIAGNOSIS: [Root cause]

SUPPORTING EVIDENCE:
- [Evidence 1]
- [Evidence 2]

FIX OPTIONS:

OPTION A: [Quick fix]
Example: "Add .wait() to wait for transaction confirmation"
Time: ~5 minutes
Risk: Low
Good for: Getting it working fast

OPTION B: [Proper fix]
Example: "Implement proper error handling and transaction state management"
Time: ~30 minutes
Risk: Low
Good for: Production-ready solution

⚠️ SMART CONTRACT WARNING ⚠️
If this fix involves changing contract code:
- Test thoroughly on testnet
- Consider audit for production
- Review all implications

Which option? (A or B)
```

## Web3 Safety Checks

Before implementing any smart contract fix:

```
⚠️ SMART CONTRACT SAFETY CHECK ⚠️

This fix modifies contract logic. Before proceeding:

1. Have you deployed this contract to mainnet? (Y/N)
2. Does it hold funds? (Y/N)
3. Can it be upgraded? (Y/N)

If mainnet + holds funds + not upgradeable:
   → I STRONGLY recommend professional audit before deploying

Are you comfortable proceeding with this fix?
- Yes, this is testnet only
- Yes, I understand the risks
- No, let me review first
```

**Wait for explicit confirmation before modifying contract code.**

---

## Example Web3 Session

```
User: "My transaction is failing"

Agent: "Web3 debugging time! Critical context:
1. Which blockchain network?
   A) Ethereum Mainnet
   B) Testnet (Goerli, Sepolia, etc.)
   C) Local (Hardhat, Ganache)
   ..."

User: "B - Goerli testnet, no transaction hash, it's not even sending"

Agent: "Got it - Goerli testnet, transaction not sending.

4. What's the error message in your console (F12)? [paste it]
5. Which wallet are you using? (MetaMask, etc.)"

User: "Error: insufficient funds for intrinsic transaction cost
MetaMask"

Agent: "Ah! 'insufficient funds' means your wallet doesn't have enough ETH to pay gas.

On Goerli testnet, you need testnet ETH (not real ETH).

QUICK FIXES:
A) Get testnet ETH from faucet (I'll give you links) - 5 min
B) Switch to different testnet with ETH in your wallet - 2 min

Which would you prefer?"
```
```

---

## Step 3: Create Decision Tree Template (5 minutes)

Create: `.claude/skills/diagnostic-tree/SKILL.md`

Copy the full decision tree from the main guide, or use this simplified version:

```yaml
---
name: diagnostic-tree
description: Systematic debugging using decision trees. Use for complex multi-layer issues.
allowed-tools: Read, Grep, Bash, Write
---

# Diagnostic Decision Tree

## Q1: Layer Identification

```
Let's diagnose systematically. First:

Which layer has symptoms?
A) Frontend (browser errors, UI issues)
B) Backend (API errors, server issues)
C) Database (query issues, data problems)
D) Multiple layers
E) Unsure

Choose one letter.
```

**WAIT FOR ANSWER**

---

### If A (Frontend):

```
Frontend issue. Next:

Where do you see the problem?
A) Browser console has errors
B) UI shows wrong content
C) Network tab shows failing requests
D) No errors, just wrong behavior

Choose one.
```

**Then investigate based on their choice**

---

### If B (Backend):

```
Backend issue. Next:

Where's the evidence?
A) Application logs show errors
B) API returns error to client
C) Monitoring tool alerts
D) Haven't checked logs yet

Choose one.
```

**Then investigate based on their choice**

---

### If C (Database):

```
Database issue. Next:

What's the symptom?
A) Queries are slow
B) Connection failures
C) Wrong data
D) Query errors

Choose one.
```

**Then investigate based on their choice**

---

## After Each Question

1. **Log the decision**: Update debug-path.txt with user's choices
2. **Narrow focus**: Ask more specific questions based on their answer
3. **Eventually**: Reach specific enough understanding to investigate

## Investigation Start

When you have enough context:

```
Based on your answers:
- Layer: [their answer to Q1]
- Specific area: [their answer to Q2]
- Issue type: [their answer to Q3]

Now I'll investigate [specific thing].
[Do investigation]
```
```

---

## Step 4: Create Context Management (5 minutes)

Create a simple context tracking pattern:

### In your skill, add:

```markdown
## Context Management

At the start of debugging, create:

```bash
cat > debug-session.json << 'EOF'
{
  "started": "2025-11-13T10:00:00Z",
  "questions_asked": [],
  "answers_received": [],
  "hypotheses": [],
  "current_phase": "GATHERING"
}
EOF
```

After each Q&A, update:

```bash
# Log question and answer
jq '.questions_asked += ["Q1: What type of issue?"]' debug-session.json > tmp.json && mv tmp.json debug-session.json
jq '.answers_received += ["A1: Error message"]' debug-session.json > tmp.json && mv tmp.json debug-session.json

# Update phase
jq '.current_phase = "INVESTIGATING"' debug-session.json > tmp.json && mv tmp.json debug-session.json
```

Before each response, read context:

```bash
cat debug-session.json
```

This maintains state across the entire session.
```

---

## Step 5: Test Your Interactive Skill

### Test Scenario 1: Basic Usage

**You say**: "I'm getting an error in my React app"

**Expected**: Skill should immediately ask 2-3 questions before investigating

**Verify**:
- [ ] Did NOT immediately read files
- [ ] Did NOT immediately run commands
- [ ] DID ask clear, structured questions
- [ ] DID wait for your response

### Test Scenario 2: Follow-Up Questions

**You answer**: The first set of questions

**Expected**: Skill should acknowledge your answers, then ask follow-up questions

**Verify**:
- [ ] Acknowledged your previous answers
- [ ] Asked relevant follow-up questions based on your answers
- [ ] Still didn't start investigating yet (if more context needed)

### Test Scenario 3: Investigation Phase

**You provide**: All needed context

**Expected**: Skill should summarize understanding, then investigate

**Verify**:
- [ ] Summarized all the context gathered
- [ ] Stated what it will investigate
- [ ] Only then started reading files/running commands
- [ ] Showed findings clearly

### Test Scenario 4: Solution Proposal

**After investigation**: Skill found the issue

**Expected**: Should present diagnosis and ask about fix approach

**Verify**:
- [ ] Clearly explained what it found
- [ ] Provided evidence
- [ ] Offered multiple solution options
- [ ] Asked which option you prefer
- [ ] Waited for your choice before implementing

---

## Common Issues and Fixes

### Issue: Claude Starts Investigating Immediately

**Problem**: Ignores "ask first" instruction

**Fix**: Make instruction more explicit:

```markdown
❌ **STOP! DO NOT INVESTIGATE YET!** ❌

Before you read ANY files or run ANY commands:
1. Ask the questions below
2. Wait for user answers
3. ONLY THEN start investigating

IF YOU START INVESTIGATING BEFORE ASKING QUESTIONS, YOU ARE DOING IT WRONG.

Questions to ask:
[your questions]
```

### Issue: Questions Are Unclear

**Problem**: User doesn't know how to answer

**Fix**: Provide structure:

```markdown
❌ Bad: "Tell me about the error"

✅ Good:
"Please provide:
1. Exact error message: [paste here]
2. Where you see it: [browser console / logs / other]
3. When it happens: [always / sometimes / once]

Example good answer:
'1. TypeError: Cannot read property x of undefined
 2. Browser console (F12)
 3. Always when I click the submit button'"
```

### Issue: Too Many Questions

**Problem**: User is overwhelmed

**Fix**: Ask in phases:

```markdown
PHASE 1 (2 questions):
"Quick context:
1. [Most critical question]
2. [Second most critical question]"

[Wait for answer]

PHASE 2 (2-3 questions):
"Thanks! Now I need to know:
3. [Follow-up based on Phase 1]
4. [Another follow-up]"

[Wait for answer]

PHASE 3 (Investigation):
"Got it. Now I'll investigate..."
```

### Issue: Losing Context

**Problem**: Claude forgets previous answers

**Fix**: Create explicit memory:

```markdown
After each answer, create/update debug-context.md:

# Debug Context

## Q&A History
- Q1: What type of issue? → A: Error message
- Q2: Where do you see it? → A: Browser console
- Q3: When did it start? → A: After deployment yesterday

## Current Understanding
Issue type: Error
Location: Browser console
Timeline: Started yesterday post-deployment
Next step: Check yesterday's deployment changes

Read this file at the start of each response to remember context.
```

---

## Next Steps

### Immediate (Today):

1. **Copy** one of the example skills above to `.claude/skills/`
2. **Test** it with a real debugging scenario
3. **Adjust** questions based on what information you actually need

### Short-term (This Week):

1. **Create** specialized skills for your main debugging areas:
   - Frontend debugging skill
   - Backend API debugging skill
   - Smart contract debugging skill
   - Database debugging skill

2. **Add** context management (debug-session.json pattern)

3. **Document** your question templates for consistency

### Long-term (This Month):

1. **Build** the decision tree skill for complex multi-layer issues

2. **Create** autonomous subagents for each layer:
   - Frontend analyzer (no questions, just reports)
   - Backend analyzer (no questions, just reports)
   - Contract analyzer (no questions, just reports)

3. **Implement** main coordinator that:
   - Asks user questions
   - Delegates to subagents
   - Synthesizes findings
   - Proposes solutions

4. **Add** safety checks for high-risk operations (contract changes, etc.)

---

## Quick Reference: Question Patterns

### For Error Debugging
```
1. What's the exact error message? [paste]
2. Where do you see it? [location]
3. Can you reproduce it? [Y/N]
```

### For Behavior Bugs
```
1. What should happen? [expected]
2. What actually happens? [actual]
3. Can you reproduce it consistently? [Y/N]
```

### For Performance Issues
```
1. How slow? [seconds/minutes]
2. Always slow or sometimes? [always/sometimes]
3. Which operation is slow? [operation]
```

### For Web3 Issues
```
1. Which network? [mainnet/testnet/local]
2. Transaction hash? [hash or "no"]
3. What's failing? [specific operation]
```

### For Deployment Issues
```
1. What changed? [code/config/environment]
2. When? [timeline]
3. Error message? [paste]
```

---

## Pro Tips

### Tip 1: Use Checkboxes for Multiple Choice
```
Which applies? (can choose multiple)
□ Frontend issue
□ Backend issue
□ Database issue
□ Not sure
```

### Tip 2: Provide Examples of Good Answers
```
Q: What's the error?

Good answer example:
"TypeError: Cannot read property 'user' of undefined
at UserProfile.jsx:45
in browser console when I click 'Profile' button"

This is better than just "there's an error" because it tells me:
- Error type
- Location in code
- Where it appears
- How to reproduce
```

### Tip 3: Acknowledge Every Answer
```
User: "The error is X"

Agent: "Got it - error X in [location]. Based on that, I'll check [specific thing]."

This confirms understanding before proceeding.
```

### Tip 4: Show Confidence Levels
```
"I'm 90% confident the issue is [X].

Should I:
A) Proceed with fixing [X]
B) Investigate more to be 100% sure
C) Check other possibilities first"
```

### Tip 5: Create Escape Hatches
```
Which should I investigate?
A) Hypothesis A
B) Hypothesis B
C) Hypothesis C
D) All three in parallel
E) Something else (describe)
F) Not sure, you decide
```

Always give users an "other" or "you decide" option!

---

## Success Metrics

You'll know your interactive debugging is working when:

1. **User provides complete context** before you investigate
2. **You find the right issue faster** because you looked in the right place
3. **User feels involved** in the debugging process
4. **Fewer false starts** - investigating wrong areas
5. **Better solutions** - because you understand user preferences (quick fix vs. proper fix)

---

## Resources

- **Full Guide**: See INTERACTIVE_QUESTIONS_GUIDE.md for comprehensive technical details
- **Research**: See RESEARCH_FINDINGS.md for deep dive into how it all works
- **Examples**: The skills in this guide are ready to use
- **Community**: Check github.com/anthropics/skills for more examples

---

## Getting Help

If your interactive questions aren't working:

1. Check that your SKILL.md has explicit "ask before investigating" instructions
2. Verify you're using "STOP and wait" language
3. Test with simpler questions first (just 1-2 questions)
4. Make sure you acknowledge user answers before proceeding
5. Add explicit state management (debug-session.json) if losing context

Happy debugging! 🎯
