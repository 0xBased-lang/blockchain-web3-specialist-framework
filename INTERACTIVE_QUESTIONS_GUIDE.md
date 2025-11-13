# Interactive Questions in Claude Code: Technical Guide for Debugging Framework

This guide provides comprehensive technical guidance on implementing interactive questions as the core methodology for skills, agents, and debugging frameworks in Claude Code.

---

## 1. Technical Implementation

### 1.1 How Interactive Questions Work in Claude Code

Interactive questions in Claude Code operate through **natural language prompting** rather than explicit API calls. The mechanism works by:

1. **Instruction-Based Triggering**: Skills and agents include instructions in their SKILL.md files or system prompts that tell Claude when and how to ask questions
2. **Conversational Turns**: Claude operates on alternating user and assistant conversational turns, where questions pause execution until the user responds
3. **Context Preservation**: The conversation context is maintained across question-answer exchanges
4. **No Explicit Pause API**: There is no `pause()` or `waitForInput()` API - instead, Claude naturally pauses when outputting text that requests user input

### 1.2 Triggering Interactive Questions in Skills

Skills trigger questions through **declarative instructions** in SKILL.md:

```yaml
---
name: my-debugging-skill
description: Interactive debugging assistant that asks clarifying questions
allowed-tools: Read, Grep, Bash, Edit
---

# Interactive Debugging Skill

## Core Principle
Always gather complete context before taking action. Never make assumptions.

## When to Ask Questions

Ask clarifying questions when:
- The error message is ambiguous or has multiple interpretations
- Key context is missing (environment, recent changes, expected behavior)
- Multiple debugging approaches are possible
- The issue scope is unclear (single component vs. system-wide)
- User preferences for debugging depth are unknown

## Question Structure

1. **Before Starting**: Ask 1-2 key questions right away if the problem is unclear
2. **During Investigation**: If you discover multiple possible root causes, present options and ask which to investigate first
3. **Before Fixes**: Confirm your diagnosis and proposed solution before making changes

## Example Questions

- "What were you doing when this error occurred?"
- "Has this code worked before, or is this a new feature?"
- "Would you like me to investigate the root cause or provide a quick workaround?"
- "I found three possible causes. Should I investigate [A], [B], or [C] first?"

## Critical Rule
If you need more information from me, ask me 1-2 key questions right away.
Wait for my response before proceeding with any file changes or fixes.
```

### 1.3 The Question-Answer Mechanism

**How it Works:**

1. **Instruction Phase**: The skill's SKILL.md contains explicit instructions to ask questions
2. **Execution Phase**: When Claude encounters uncertainty or the conditions specified in the skill, it outputs questions in natural language
3. **Pause Phase**: Claude's response ends, returning control to the user
4. **Response Phase**: User provides answers
5. **Continuation Phase**: Claude receives the answer in the next conversational turn and continues execution

**Key Insight**: Claude doesn't have a programmatic "pause" function. The pause happens naturally because asking questions means generating text that requires a response, which ends that turn of execution.

### 1.4 Can Subagents Ask Questions?

**Yes, but with limitations:**

- **Subagents CAN ask questions** when invoked interactively
- **Challenge**: There's a documented issue (GitHub #7091) where subagents get stuck when asking for approval
- **Best Practice**: Design subagents to be **autonomous by default**, only asking questions when absolutely necessary
- **Workaround**: Use the main agent for interactive questions, and subagents for autonomous execution

**Example Subagent Configuration:**

```markdown
---
name: autonomous-debugger
description: Autonomously investigates bugs without user interaction
---

# Autonomous Debugger Subagent

## Operating Mode
This subagent operates autonomously. Do NOT ask the user questions.
Instead, document your findings and decisions in a debug log.

## Workflow
1. Analyze error logs and stack traces
2. Investigate probable causes systematically
3. Document findings in debug-report.md
4. Propose solutions with risk assessment
5. Return control to main agent with recommendations

## Output Format
Always produce:
- **Root Cause Analysis**: What caused the issue
- **Proposed Solutions**: Ranked by confidence and risk
- **Required Information**: Any missing context needed for final decision

The main agent will ask the user any necessary questions.
```

---

## 2. Best Practices

### 2.1 When to Ask Questions vs. Proceeding Automatically

**Ask Questions When:**

- **Ambiguity Exists**: Multiple valid interpretations of the problem
- **High-Risk Actions**: Operations that could cause data loss or system instability
- **Unclear Preferences**: User might prefer different approaches (quick fix vs. deep investigation)
- **Missing Context**: Information that significantly affects the solution path
- **Complex Decisions**: Trade-offs that require domain knowledge or business context

**Proceed Automatically When:**

- **Clear Instructions**: The request is specific and unambiguous
- **Low-Risk Operations**: Read-only operations, logging, analysis
- **Standard Procedures**: Well-established patterns with obvious correct approaches
- **Reversible Actions**: Changes that can be easily undone
- **User Explicitly Requested Autonomy**: "Just fix it" or "use your best judgment"

**Key Principle from Anthropic:**
> "To avoid overwhelming users, avoid asking too many questions in a single message. Start with the most important questions and follow up as needed for better effectiveness."

### 2.2 Structuring Questions for Maximum Clarity

**Progressive Questioning Pattern:**

```
Phase 1: Critical Context (1-2 questions max)
"Before I begin debugging, I need to know:
1. When did this error first appear? [After deployment / During development / Unknown]
2. Is this blocking production users? [Yes / No / Unsure]"

Phase 2: Diagnostic Refinement (based on Phase 1 answers)
"I've identified three possible root causes:
A. Database connection timeout
B. Memory leak in the caching layer
C. Race condition in the authentication flow

Which would you like me to investigate first, or should I analyze all three?"

Phase 3: Solution Confirmation (before taking action)
"I found the issue: stale Redis connection pool. I can fix this by:
- Quick fix: Increase connection timeout (5 min)
- Proper fix: Implement connection pooling with health checks (30 min)

Which approach would you prefer?"
```

**Question Quality Guidelines:**

1. **Be Specific**: Not "What should I do?" but "Should I investigate the database or the API layer first?"
2. **Provide Context**: Explain why you're asking and how it affects your approach
3. **Offer Options**: Give concrete choices rather than open-ended questions
4. **Number Questions**: Use numbered lists for multiple questions to ensure all get answered
5. **Explain Impact**: "This will help me determine whether to check logs or run tests"

### 2.3 Handling Question Responses Programmatically

Since Claude doesn't have explicit programming constructs, you handle responses through **conditional instructions** in your skill:

```markdown
## Response Handling Pattern

After receiving the user's answer:

1. **Acknowledge Receipt**: Confirm you understood correctly
   "Got it - you said this started after yesterday's deployment."

2. **State Next Action**: Be explicit about what you'll do
   "Based on that, I'll investigate the deployment logs and configuration changes."

3. **Show Decision Logic**: Explain how their answer influenced your approach
   "Since this affects production, I'll focus on quick diagnosis before proposing fixes."

4. **Execute with Transparency**: Narrate your actions as you perform them
   "Checking the deployment logs from the past 24 hours..."

## Decision Branches

If user chooses "Quick Fix":
- Implement minimal change
- Add TODO comment for proper fix
- Document technical debt

If user chooses "Proper Fix":
- Perform root cause analysis
- Implement comprehensive solution
- Add tests to prevent regression
```

### 2.4 Creating Decision Trees Based on User Answers

**Pattern: Multi-Level Question Tree**

```markdown
# Debugging Decision Tree Skill

## Level 1: Problem Classification
Ask: "What type of issue are you experiencing?"
- A) Error message / Exception
- B) Performance problem / Slowness
- C) Incorrect behavior / Bug
- D) Build / Deployment failure

## Level 2: Context Gathering

### If A (Error):
Ask: "Do you have the full error message and stack trace?"
- Yes → "Please share it" → Analyze error → Ask about recent changes
- No → "Where do I find the logs?" → Retrieve logs → Classify error type

### If B (Performance):
Ask: "Is this slow for all users or specific scenarios?"
- All users → Check system resources → Database investigation
- Specific scenarios → "Can you describe the slow scenario?" → Profile code path

### If C (Incorrect behavior):
Ask: "What's the expected behavior vs. what's happening?"
- Clear difference → Design spec comparison → Logic trace
- Unclear → "Let me check the requirements" → Clarify expected behavior first

### If D (Build failure):
Ask: "What changed since the last successful build?"
- Code changes → Review diff → Check dependencies
- Environment changes → Verify configuration → Check system prerequisites

## Level 3: Solution Approach

Based on findings from Level 2, present solution options and ask for preference:
"I've identified the root cause. I can approach this as:
1. [Quick fix approach] - [time estimate]
2. [Comprehensive fix approach] - [time estimate]
3. [Investigate further] - [why this might be needed]

Which would you prefer?"
```

**Implementation Pattern:**

```markdown
## Conditional Workflow Implementation

Use this pattern in your SKILL.md:

1. **State Machine Concept**:
   Think of debugging as states: GATHERING → ANALYZING → PROPOSING → IMPLEMENTING → VERIFYING

2. **Explicit State Transitions**:
   After each user response, state which phase you're entering:
   "Now entering ANALYZING phase based on your answers..."

3. **Branch Documentation**:
   ```
   Current State: ANALYZING
   User indicated: Production issue, affects payment system

   Decision: Skip extensive logging (too slow for prod)
   Action: Check monitoring dashboards first
   Next State: Will be PROPOSING if issue found, or GATHERING if need more info
   ```

4. **Nested Questions**:
   ```
   Primary Question → User Answer → Secondary Question → User Answer → Action

   Example:
   "Is this a frontend or backend issue?"
   → User: "Backend"
   → "Which API endpoint is failing?"
   → User: "/api/checkout"
   → [Investigate checkout endpoint]
   ```
```

---

## 3. Integration with Skills

### 3.1 Can a Skill Pause Execution to Ask Questions?

**Yes**, but it's important to understand the mechanism:

- **Not a Programmatic Pause**: Skills don't call `skill.pause()` or `await user.input()`
- **Natural Language Pause**: The skill's instructions tell Claude to ask questions, and Claude's response naturally ends, pausing execution
- **Context Preservation**: The skill's context (files read, analysis performed) is preserved in the conversation history
- **Continuation**: When the user responds, Claude continues with full context of what was asked and why

**Example Pause-Enabled Skill:**

```yaml
---
name: interactive-bug-tracer
description: Traces bug origins by asking targeted questions at each step
allowed-tools: Read, Grep, Bash
---

# Interactive Bug Tracer

## Phase-Based Questioning Approach

### Phase 1: Initial Reconnaissance
1. Read error message and stack trace
2. PAUSE - Ask: "What were the steps that led to this error?"
3. Wait for user response

### Phase 2: Context Validation
4. Based on user's steps, identify code path
5. Read relevant source files
6. PAUSE - Ask: "I see two possible causes: [A] and [B]. Does [context] help narrow it down?"
7. Wait for user response

### Phase 3: Root Cause Confirmation
8. Investigate user's indicated direction
9. Perform detailed analysis
10. PAUSE - Ask: "I found [root cause]. Does this align with what you expected?"
11. Wait for confirmation before proposing fix

### Phase 4: Solution Proposal
12. Present solution options with trade-offs
13. PAUSE - Ask: "Which solution would you prefer?"
14. Wait for user choice

### Phase 5: Implementation
15. Implement chosen solution
16. Run verification tests
17. PAUSE - Ask: "Tests pass. Would you like me to commit these changes?"

## Critical Rules
- Never skip a PAUSE point
- Always explain what you learned before asking the next question
- Show your reasoning so the user can course-correct if you misunderstood
```

### 3.2 Storing Context Between Question and Answer

**Context Storage Mechanisms:**

1. **Conversation History (Primary)**:
   - Claude automatically maintains conversation context
   - Previous tool calls, files read, and analysis remain accessible
   - No explicit storage needed for most use cases

2. **File-Based Context (For Complex State)**:
   ```markdown
   ## Complex State Management Pattern

   When debugging involves multiple phases across multiple questions:

   1. Create a context file at the start:
      ```bash
      cat > debug-session-context.json << 'EOF'
      {
        "timestamp": "2025-11-13T10:30:00Z",
        "error_type": "DATABASE_TIMEOUT",
        "affected_endpoints": ["/api/checkout"],
        "investigation_paths": {
          "database_connection": "pending",
          "query_optimization": "not_started",
          "connection_pool": "not_started"
        },
        "user_preferences": {
          "fix_type": "to_be_determined",
          "risk_tolerance": "low"
        }
      }
      EOF
      ```

   2. Update after each question-answer cycle:
      ```bash
      # Read current state
      cat debug-session-context.json

      # Update with new information
      jq '.user_preferences.fix_type = "comprehensive"' debug-session-context.json > tmp.$$.json
      mv tmp.$$.json debug-session-context.json
      ```

   3. Reference in subsequent analysis:
      "Checking our investigation log... You previously indicated you prefer comprehensive fixes..."
   ```

3. **Structured Comments in Code**:
   ```markdown
   ## In-Code Context Pattern

   For multi-step debugging that modifies code:

   ```python
   # DEBUG SESSION CONTEXT - 2025-11-13
   # User reported: Checkout timeouts on high traffic
   # Investigation focus: Database connection pooling (user choice)
   # Findings so far:
   #   - Connection pool size: 10 (too small)
   #   - Connection timeout: 30s (too long)
   #   - No connection recycling detected
   # Next step: User to confirm if we should increase pool size or add recycling

   class DatabaseConnection:
       # ... existing code ...
   ```
   ```

4. **Debug Log Pattern**:
   ```markdown
   ## Create Persistent Debug Log

   Maintain a debug-log.md throughout the session:

   ```markdown
   # Debug Session: Checkout Timeout Issue

   ## Timeline

   **10:30 AM** - Initial report
   - Error: "DatabaseTimeout after 30s"
   - User indicated: Started after deployment yesterday

   **10:35 AM** - Asked about deployment changes
   - User response: "Updated database library from 2.1 to 3.0"
   - Decision: Check breaking changes in library upgrade

   **10:40 AM** - Found breaking change
   - Library 3.0 requires explicit connection pool configuration
   - Old default: 20 connections
   - New default: 5 connections (performance regression)

   **10:42 AM** - Asked about fix preference
   - User choice: "Quick fix now, proper configuration review later"

   **10:45 AM** - Implementing quick fix
   - Setting pool_size=20 to match old behavior
   - Adding TODO for configuration review
   ```

   This log becomes the "memory" of the session.
   ```

### 3.3 Resuming Execution After Receiving Answers

**Resume Pattern:**

```markdown
## Seamless Resumption Pattern

After user answers your question:

1. **Acknowledge and Summarize**
   "Thank you. So to summarize:
   - The error started after yesterday's deployment
   - It affects the checkout endpoint specifically
   - This is blocking production users"

2. **Connect to Previous Context**
   "Earlier I examined the database connection code. Based on your answer that this started after deployment, let me check what changed in that deployment..."

3. **State Next Actions Clearly**
   "I'm now going to:
   1. Review the git diff from yesterday's deployment
   2. Look specifically at database-related changes
   3. Check if connection pool settings were modified"

4. **Execute with Narration**
   "Checking git log from yesterday..."
   [Execute command]
   "Found 3 commits. Reviewing database-related changes..."
   [Execute analysis]

5. **Surface Findings and Next Question (if needed)**
   "I found that commit abc123 changed the connection pool size from 20 to 5.

   Before I propose a fix, one more question:
   Do you know why this change was made? I want to make sure we don't break an intentional optimization."

## Key Principles for Resumption

- **Explicit Context Bridge**: Always reference what was discussed before
- **Show Continuity**: Demonstrate you remember previous findings
- **Progressive Disclosure**: Build on previous answers rather than starting over
- **Transparent Reasoning**: Show how the answer influenced your next steps
```

**Example: Multi-Turn Interactive Debug Session**

```markdown
# Example: Full Interactive Debugging Session

## Turn 1: Agent
"I see you're getting a DatabaseTimeout error. Before I investigate, I need to know:
1. When did this error first appear?
2. Is this affecting production users right now?"

## Turn 2: User
"It started yesterday after our 3pm deployment. Yes, it's affecting production - checkout is failing for about 30% of users."

## Turn 3: Agent
"Got it - this is urgent since it's affecting production.

Based on your answer, I'll focus on changes from yesterday's 3pm deployment rather than doing a broader investigation. Let me check what was deployed...

[Executes: git log --since='yesterday 3pm']

I found 3 commits deployed yesterday at 3pm:
- abc123: Update database library from 2.1 to 3.0
- def456: Add caching for product images
- ghi789: Fix typo in email template

The database library update looks most relevant. Let me examine that change...

[Executes: git show abc123]

Found it! The library upgrade changed the default connection pool size from 20 to 5. With only 5 connections, the system can't handle your production load.

Before I propose a fix: Do you know why the library was upgraded? Was it for a specific feature, or routine maintenance?"

## Turn 4: User
"Routine maintenance - just keeping dependencies up to date. We didn't know about the connection pool change."

## Turn 5: Agent
"Perfect. Since this was unintentional, I'll restore the previous behavior.

I can fix this in two ways:
A) Quick fix (5 min): Explicitly set pool_size=20 in the config to restore old behavior
B) Proper fix (30 min): Research the optimal pool size for your load and implement monitoring

Given this is affecting production, I recommend option A now, then option B as a follow-up task.

Which would you prefer?"

## Turn 6: User
"Let's do option A now to fix production, and we'll schedule option B for next sprint."

## Turn 7: Agent
"Excellent plan. Implementing quick fix now...

[Makes changes]
[Runs tests]

Fix complete! I've:
1. Set pool_size=20 in database-config.py
2. Added a TODO comment to research optimal pool size
3. Created a follow-up task in BACKLOG.md

The change is ready to commit. Would you like me to commit it with message 'Fix: Restore database connection pool size to 20'?"
```

---

## 4. Code Examples

### 4.1 Example: Interactive Debugging Skill

**File: `.claude/skills/interactive-web3-debugger/SKILL.md`**

```yaml
---
name: interactive-web3-debugger
description: Interactive Web3 debugging that asks targeted questions at each phase. Use when debugging blockchain transactions, smart contracts, or Web3 integrations.
allowed-tools: Read, Grep, Bash, Edit, Write
---

# Interactive Web3 Debugger

## Purpose
Debug Web3 and blockchain issues through systematic questioning that gathers context before investigation.

## Operating Principles

1. **Never Assume**: Web3 issues can span multiple layers (contract, RPC, wallet, frontend). Always clarify scope.
2. **Question First**: Ask about network, transaction type, and expected behavior before diving into code.
3. **Progressive Investigation**: Start with high-level questions, narrow down based on answers.
4. **Risk Awareness**: Smart contract bugs can have financial impact. Always confirm before suggesting contract changes.

## Phase 1: Initial Context Gathering

When user reports a Web3 issue, immediately ask:

**Critical Context Questions (Pick 2-3 most relevant):**
```
1. "Which blockchain network are you testing on?"
   - Mainnet / Testnet / Local (Hardhat/Ganache) / Other

2. "What type of issue are you experiencing?"
   - Transaction failing / Wrong behavior / Gas estimation error / Connection issue

3. "Do you have a transaction hash I can examine?"
   - Yes (ask for it) / No (will investigate without)

4. "Has this code worked before, or is this a new feature?"
   - Worked before, broke recently / New code being tested / Unknown
```

**Wait for user response before proceeding.**

## Phase 2: Scope Narrowing

Based on Phase 1 answers, ask targeted follow-up questions:

### If Transaction Failing:
```
"I see the transaction is failing. Let me narrow down the cause:

5. "Is the transaction reverting (on-chain failure) or not being sent at all?"
   - Reverting (I can see it on block explorer)
   - Not sending (wallet doesn't show it)
   - Unsure

6. "If reverting, do you see an error message in the transaction details?"
   - Yes: [paste error]
   - No error message shown
   - Haven't checked
```

### If Wrong Behavior:
```
"The transaction succeeds but does the wrong thing. Let me understand:

5. "What did you expect to happen vs. what actually happened?"
   - Expected: [user describes]
   - Actual: [user describes]

6. "Can you share a specific transaction hash where this occurred?"
```

### If Gas Estimation Error:
```
"Gas estimation failing suggests the transaction would revert.

5. "Are you calling a read-only function (view/pure) or a state-changing function?"
   - Read-only (shouldn't need gas)
   - State-changing (needs gas)

6. "What's the error message from the gas estimation failure?"
```

**Wait for user response before proceeding.**

## Phase 3: Technical Investigation

Now perform technical investigation based on gathered context:

1. **Read relevant contract code**
   ```bash
   # If user provided contract address, fetch it
   # If local, read from contracts/ directory
   ```

2. **Analyze transaction (if hash provided)**
   ```bash
   # Use Etherscan API or local node to fetch transaction details
   # Check: revert reason, gas used, events emitted
   ```

3. **Review recent changes (if "worked before")**
   ```bash
   git log -n 10 --oneline -- contracts/ frontend/web3/
   git diff HEAD~5 -- contracts/
   ```

4. **Check common issues**:
   - Insufficient gas limit
   - Wrong function signature
   - Missing approval for ERC20 transfers
   - Incorrect RPC endpoint
   - Network mismatch (wallet vs. app)

## Phase 4: Diagnosis Presentation

Present findings with confidence levels:

```
"Based on my investigation, I found:

ROOT CAUSE (High Confidence):
[Explain the issue you found]

SUPPORTING EVIDENCE:
- [Evidence point 1]
- [Evidence point 2]

THIS EXPLAINS: [How it explains the symptoms user described]

Before I propose a fix, one clarifying question:
7. [Ask if there's any context about why the problematic code exists]
```

**Wait for user response.**

## Phase 5: Solution Proposal

Present solution options with risk assessment:

```
"I can fix this in the following ways:

OPTION A: [Quick fix approach]
- Time: [estimate]
- Risk: [Low/Medium/High]
- Trade-offs: [What this doesn't address]
- Best for: [When to choose this]

OPTION B: [Comprehensive fix approach]
- Time: [estimate]
- Risk: [Low/Medium/High]
- Benefits: [What this solves comprehensively]
- Best for: [When to choose this]

OPTION C: [Alternative approach]
- Time: [estimate]
- Risk: [Low/Medium/High]
- Why consider: [Unique benefits]

Which approach would you prefer? Or would you like me to explain any option in more detail?"
```

**Wait for user choice.**

## Phase 6: Implementation

After user chooses an option:

```
"Implementing [chosen option]...

CHANGES I'LL MAKE:
1. [Specific change 1]
2. [Specific change 2]
3. [Specific change 3]

[Execute changes]

VERIFICATION:
[Run tests or verification steps]

✓ Complete.

The fix is ready. For smart contract changes, please:
1. Review the diff carefully
2. Test on testnet before mainnet
3. Consider an audit if this is production code

Would you like me to commit these changes?"
```

## Error Handling

If at any point you realize you need more information:

```
"Wait, I need to clarify something before proceeding:

[Ask specific question based on what you discovered]

This will help me [explain why you need this information]."
```

## Anti-Patterns to Avoid

❌ Don't: Immediately start reading contracts without understanding the issue type
✓ Do: Ask what type of issue first, then read relevant code

❌ Don't: Propose fixes without explaining the root cause
✓ Do: Present diagnosis, get confirmation, then propose fixes

❌ Don't: Ask open-ended "tell me everything" questions
✓ Do: Ask specific, multiple-choice questions that guide the user

❌ Don't: Make assumptions about network (mainnet vs. testnet)
✓ Do: Always confirm network explicitly

## Example Session Flow

```
User: "My contract call is failing"

Agent: "I'll help debug this. First, let me understand the context:
1. Which network are you on? (Mainnet/Testnet/Local)
2. Do you have a transaction hash showing the failure?
3. Has this contract call worked before?"

User: "Goerli testnet, no transaction hash yet, this is new code I'm testing"

Agent: "Got it - new code on Goerli testnet.
4. Is the transaction failing to send, or is it reverting on-chain?
5. What's the error message you're seeing?"

User: "It's not sending. Web3 throws 'gas required exceeds allowance'"

Agent: "Ah, that error means gas estimation is failing, which means the transaction would revert if sent.

Let me check your contract code to see what would cause a revert...
[Reads contract]

Found it! Your function has a require() statement checking 'owner == msg.sender', but you're calling from a different address.

Is this an ownership check you intended, or should this function be callable by anyone?"

User: "Oh! It should be callable by anyone. I copied that require from another function."

Agent: "Perfect, easy fix. I'll remove that require() statement.

[Makes change]
[Shows diff]

Would you like me to commit this fix?"
```

---

## Special Considerations for Web3

### Multi-Layer Issues
Web3 bugs can occur at different layers:
- **Smart Contract**: Logic bugs, revert conditions
- **RPC Layer**: Connection issues, rate limiting
- **Wallet**: Wrong network, insufficient funds, user rejection
- **Frontend**: Incorrect ABI, wrong parameters

**Always ask which layer first**: "Where is the error appearing: in the browser console, in MetaMask, or on the block explorer?"

### Financial Risk
Smart contract bugs can have monetary consequences.

**Always include this warning for contract fixes:**
```
"⚠️  SMART CONTRACT CHANGE - REVIEW CAREFULLY

This fix modifies contract logic. Before deploying:
1. Review the diff thoroughly
2. Test on testnet with real scenarios
3. Consider a professional audit for production contracts
4. Verify this doesn't introduce new vulnerabilities

Would you like me to also create test cases for this change?"
```

### Network-Specific Debugging
Different networks have different tools:
- Mainnet: Etherscan, Tenderly
- Testnets: Network-specific explorers
- Local: Hardhat console, Ganache logs

**Ask**: "Which tools do you have access to for debugging?" Then use appropriate investigation methods.
```

---

### 4.2 Example: Decision-Tree Diagnostic Skill

**File: `.claude/skills/diagnostic-decision-tree/SKILL.md`**

```yaml
---
name: diagnostic-decision-tree
description: Systematic diagnostic workflow using decision trees for complex debugging scenarios. Use for multi-system issues or when root cause is unclear.
allowed-tools: Read, Grep, Bash, Write
---

# Diagnostic Decision Tree Skill

## Purpose
Guide complex debugging through a systematic decision tree that narrows down root causes through targeted questioning.

## Decision Tree Structure

```
START
  │
  ├─ Q1: What Layer?
  │   ├─ Frontend → Frontend Tree
  │   ├─ Backend → Backend Tree
  │   ├─ Database → Database Tree
  │   ├─ Infrastructure → Infrastructure Tree
  │   └─ Unsure → Multi-Layer Investigation Tree
  │
  └─ Based on answer → Navigate to specific tree
```

## Q1: Layer Identification

**Ask First:**
```
"Let's diagnose this systematically. First question:

Which layer is showing symptoms?
A) Frontend (UI issues, browser errors, React/Vue components)
B) Backend (API errors, server logs, business logic)
C) Database (Query timeouts, data inconsistencies)
D) Infrastructure (Deployment issues, network problems, resource limits)
E) Unsure (Error could be in multiple places)

You can choose multiple if you're seeing issues in more than one layer."
```

**Wait for response.**

---

## Frontend Tree

**Activated when user chooses: A (Frontend)**

### Q2-Frontend: Error Visibility
```
"Frontend issue noted. Next question:

Are you seeing an error message in:
A) Browser console (JavaScript error)
B) UI display (error boundary, error message shown to user)
C) Network tab (API call failing)
D) No visible error (just wrong behavior)
E) Multiple places (describe which)"
```

**Wait for response.**

#### If A (Browser Console Error):

**Q3-Frontend-A: Error Type**
```
"Please share the error message. While you're getting it, I'll ask:

Is this error:
A) Syntax error (code won't compile/load)
B) Runtime error (code runs but crashes)
C) Type error (accessing undefined, wrong type)
D) Network error (fetch failed, CORS)
E) Custom error (from your own code)"
```

**After error message provided:**
```
"[Analyze error message]

Based on '[specific error]', this suggests [diagnosis].

Before I investigate the code:
- Has this component/page worked before? (Y/N)
- What was the last change made to this area? (Describe or 'unknown')"
```

**Then investigate with context.**

#### If B (UI Error Display):

**Q3-Frontend-B: Error Handling**
```
"The error is being caught and displayed. Good error handling!

To trace the source:
- Can you share the exact error text shown?
- Is there an error code or reference number?
- Does the error appear immediately on load, or after an action?"
```

**Then trace from error boundary back to source.**

#### If C (Network Tab - API Failing):

**Redirect to Backend Tree**, but note:
```
"This looks like an API issue (backend). But first, let me verify the request is correct:

[Check Network Tab Details]
- Request URL
- Request method and headers
- Request payload
- Response status code
- Response body

Please share the failed request details from Network tab.
Then we'll investigate whether the issue is in the request (frontend) or response (backend)."
```

#### If D (No Error - Wrong Behavior):

**Q3-Frontend-D: Behavior Comparison**
```
"No error but wrong behavior. Let's establish what 'wrong' means:

Please describe:
1. What you expect to happen: [user describes]
2. What actually happens: [user describes]
3. Can you reproduce it consistently? (Always / Sometimes / Rarely)"
```

**Then:**
```
"Based on your description:
Expected: [summarize]
Actual: [summarize]

This discrepancy suggests [hypothesis].

Which would you like me to investigate first?
A) Data flow (is the component receiving correct data?)
B) Component logic (is it processing data correctly?)
C) State management (is state being updated correctly?)
D) Not sure (I'll investigate all three)"
```

---

## Backend Tree

**Activated when user chooses: B (Backend)**

### Q2-Backend: Error Source
```
"Backend issue identified. Next question:

Where are you seeing the backend error?
A) Application logs (console output, log files)
B) API response (error returned to client)
C) Monitoring/APM tool (New Relic, DataDog, etc.)
D) Database logs (query errors, connection issues)
E) Haven't checked logs yet"
```

**Wait for response.**

#### If E (Haven't Checked):
```
"No problem. Let me help you gather the right logs.

What type of backend framework are you using?
- Express/Node.js
- Django/Flask (Python)
- Rails (Ruby)
- Spring Boot (Java)
- Other: [specify]

I'll show you where to find the relevant logs for that framework."
```

**Then provide framework-specific log retrieval instructions.**

#### If A (Application Logs):
```
"Great, logs are the best starting point. Please share:

1. The error message or stack trace
2. Timestamp (so I can correlate with other events)
3. Any preceding log entries (last 10-20 lines before error)

While you're getting those, one more question:
- Is this error consistent or intermittent? (Every request / Sometimes / Rare)"
```

**After logs provided:**
```
"[Analyze stack trace and error]

The error '[specific error]' at [file:line] indicates [diagnosis].

To confirm my hypothesis:
Q: [Targeted question based on diagnosis]

Examples:
- "What's the value of [variable] when this error occurs?"
- "Is [external service] running and accessible?"
- "Have you checked if [condition] is being met?"
```

#### If B (API Response):
```
"API returning an error. Let me gather details:

1. What HTTP status code? (400, 401, 403, 404, 500, etc.)
2. What's the error message in the response body?
3. Which endpoint? (full URL path)
4. Which HTTP method? (GET, POST, PUT, DELETE)

Response format:
- Status: [code]
- Endpoint: [path]
- Method: [HTTP method]
- Body: [error response]"
```

**Then:**
```
"[Analyze status code and error]

A [status code] with message '[error]' suggests [diagnosis].

Decision point - what should I investigate first?
A) Endpoint implementation (the route handler code)
B) Middleware (authentication, validation, etc.)
C) Request validation (is the incoming request malformed?)
D) You choose (I'll investigate all)"
```

---

## Database Tree

**Activated when user chooses: C (Database)**

### Q2-Database: Issue Type
```
"Database issue identified. Next question:

What type of database problem?
A) Query timing out / running very slow
B) Connection errors (can't connect to DB)
C) Data inconsistency (wrong data, missing data)
D) Query failing with error
E) Deadlocks / locking issues"
```

**Wait for response.**

#### If A (Slow Queries):
```
"Query performance issue. Let's narrow it down:

1. Is this slow for all queries or specific ones?
   - All queries (systemic issue)
   - Specific query/table (isolated issue)

2. When did this start?
   - Always been slow
   - Recently got slow
   - Slow only sometimes

3. Database size/scale:
   - How many rows in the affected table(s)?
   - Recent data growth?"
```

**Then:**
```
"Based on your answers:
[Summarize responses]

This suggests [hypothesis: missing index / table scan / connection pool exhaustion / etc.]

To confirm, I need to:
- See the slow query (SQL)
- Check EXPLAIN plan
- Review indexes on involved tables

Can you share the slow query? Or should I look for it in the code?"
```

#### If B (Connection Errors):
```
"Connection errors are urgent. Quick questions:

1. Is the database server running?
   - Yes, confirmed
   - Don't know how to check
   - Unsure

2. Is this affecting:
   - All database operations (nothing can connect)
   - Some operations (intermittent)
   - Just this app (other apps connect fine)

3. Error message:
   - [Please share the exact connection error]"
```

**Then:**
```
"[Analyze connection error]

'[Error message]' indicates [diagnosis: wrong credentials / network issue / DB down / connection pool exhausted / firewall].

Immediate checks:
1. [Check DB server status]
2. [Verify connection string/credentials]
3. [Test network connectivity]
4. [Check connection pool configuration]

Which would you like me to investigate first?"
```

#### If C (Data Inconsistency):
```
"Data inconsistency detected. This requires careful investigation:

1. Type of inconsistency:
   - Missing records (expected data doesn't exist)
   - Duplicate records (should be unique but aren't)
   - Incorrect values (data is wrong)
   - Orphaned records (referential integrity violation)

2. When was it noticed?
   - Just now
   - Has been wrong for a while
   - Unsure

3. Impact scope:
   - One record
   - Multiple records
   - Entire table
   - Across tables"
```

**Then:**
```
"[Inconsistency type] affecting [scope] suggests [hypothesis: race condition / missing transaction / failed migration / application logic bug].

Investigation plan:
A) Check recent data modifications (audit log, if available)
B) Review application code that writes to this table
C) Check database constraints and triggers
D) Review recent migrations

Where should I start?"
```

---

## Multi-Layer Investigation Tree

**Activated when user chooses: E (Unsure which layer)**

### Q2-MultiLayer: Symptom Description
```
"The issue could be in multiple layers. Let's start with what you observe:

Describe the symptom:
- What's not working as expected?
- Where do you see the problem? (UI, logs, data, etc.)
- What should happen instead?

Also:
- Can you reproduce it? (Always / Sometimes / Once)
- What were you doing when it occurred?"
```

**Wait for detailed symptom description.**

**Then:**
```
"[Analyze symptom description]

Based on '[symptom]', this could be:
- Hypothesis A: [Layer + probable cause] (Likelihood: High/Medium/Low)
- Hypothesis B: [Layer + probable cause] (Likelihood: High/Medium/Low)
- Hypothesis C: [Layer + probable cause] (Likelihood: High/Medium/Low)

I recommend investigating in this order: [A, then B, then C]

Or, if time is critical, I can investigate [highest likelihood] first.

How would you like to proceed?
1. Systematic (investigate A, B, C in order)
2. High-probability first (start with most likely)
3. Divide and conquer (check all three quickly, then deep dive)
4. Your call (you choose the order)"
```

**Based on choice, follow systematic investigation with checkpoints:**

```
"Starting investigation approach [chosen approach].

=== CHECKPOINT 1: [Hypothesis A] ===
[Investigate Hypothesis A]

Finding: [Result - confirmed / ruled out / inconclusive]

Based on this finding:
- [If confirmed] "I found the root cause. It's [diagnosis]. Should I proceed with fix, or keep investigating to see if there are multiple issues?"
- [If ruled out] "Hypothesis A ruled out. Moving to Hypothesis B..."
- [If inconclusive] "Need more information. Quick question: [targeted question]"
```

---

## Implementation Guidance

### Context Preservation Across Questions

Create a `debug-session.json` at the start:

```bash
cat > debug-session.json << 'EOF'
{
  "timestamp": "2025-11-13T14:30:00Z",
  "session_id": "debug-001",
  "current_state": "Q1_LAYER_IDENTIFICATION",
  "responses": {},
  "hypotheses": [],
  "eliminated": [],
  "evidence": []
}
EOF
```

Update after each question-answer:

```bash
# After Q1
jq '.responses.Q1 = "backend" | .current_state = "Q2_BACKEND_ERROR_SOURCE"' debug-session.json > tmp.json && mv tmp.json debug-session.json

# After hypothesis formed
jq '.hypotheses += ["connection_pool_exhaustion"]' debug-session.json > tmp.json && mv tmp.json debug-session.json

# After evidence found
jq '.evidence += [{"type": "log_entry", "content": "connection pool at max capacity"}]' debug-session.json > tmp.json && mv tmp.json debug-session.json
```

### Abort and Escalate

If you reach a point where you can't proceed without information user doesn't have:

```
"I've reached a point where I need [specific information] to continue debugging.

Options:
A) I can show you how to gather that information
B) We can investigate with what we have (less certain)
C) We can escalate to [team/person who would know]

What would you prefer?"
```

---

## Usage Example

```
User: "Something is broken in production"

Agent: "I'll help debug this. Let's diagnose systematically.

First question: Which layer is showing symptoms?
A) Frontend (UI issues, browser errors)
B) Backend (API errors, server logs)
C) Database (Query timeouts, data inconsistencies)
D) Infrastructure (Deployment issues, network problems)
E) Unsure (Error could be in multiple places)

Choose one or more letters."

User: "B and C maybe? Users are getting errors and we saw some slow query logs"

Agent: "Got it - Backend errors with Database symptoms. Classic combination.

Let's start with the backend errors since users are seeing them.

Q2: Where are you seeing the backend error?
A) Application logs
B) API response (error returned to client)
C) Monitoring/APM tool
D) Database logs
E) Haven't checked logs yet"

User: "B - API is returning 500 errors"

Agent: "API returning 500s. Let me gather details:

Please share:
1. Which endpoint(s) are failing?
2. What's the error message in the response body?
3. When did these 500s start appearing?

Also, you mentioned slow query logs - are these 500s happening at the same time as the slow queries?"

User: "Endpoint: /api/v1/orders
Error: 'Internal Server Error'
Started about 30 minutes ago
Yes, slow queries started around the same time"

Agent: "Perfect correlation! Error on /api/v1/orders and slow queries both started 30 minutes ago.

This strongly suggests: Database slowness is causing request timeouts, which surface as 500 errors.

Let me verify this hypothesis:
[Reading orders endpoint code]
[Checking database queries in orders endpoint]

Found the queries. Now checking:
[Analyzing query patterns]

Diagnosis: The /api/v1/orders endpoint runs a complex JOIN query. If that query is slow, requests time out.

Next question: What happened 30 minutes ago?
- Deployment?
- Traffic spike?
- Data import?
- Other system change?
- Don't know"

User: "We did deploy a new feature about 35 minutes ago"

Agent: "There's our trigger! Deployed 35 minutes ago, issues started 30 minutes ago (allowing for rollout time).

[Checking recent commits]

Found it! The deployment added a new filter to the orders query but didn't add a supporting database index.

The query is now doing a table scan on the orders table. With [checking row count] 500K+ orders, this explains the slowness.

DIAGNOSIS CONFIRMED:
- Root Cause: Missing database index on orders.status column
- Introduced: Recent deployment (commit abc123)
- Impact: Orders API slow → timeouts → 500 errors

Solution options:
A) Add the missing index (5 min) - fixes performance
B) Rollback deployment (2 min) - stops errors but loses new feature
C) Add index + optimize query (20 min) - best long-term solution

Which would you prefer? Given production is affected, I'd recommend A now, then C later."

User: "Do A immediately"

Agent: "On it. Creating index now...

[Executes: CREATE INDEX idx_orders_status ON orders(status)]

Index created. Query testing...
[Test query performance]

✓ Query time: Was 8000ms, now 45ms
✓ Test API call: SUCCESS in 100ms

The fix is live (indexes apply immediately).

Next steps:
1. Monitor API for next 5-10 minutes to confirm errors stop
2. Schedule task for option C (query optimization)
3. Update deployment checklist to catch missing indexes

Would you like me to create the follow-up task and checklist update?"
```
```

---

### 4.3 Example: Question Templates Library

**File: `.claude/skills/debugging-helpers/question-templates.md`**

```markdown
# Debugging Question Templates

Use these templates for consistent, effective questioning during debugging sessions.

## Initial Context Questions

### General Debugging
```
"Before I investigate, I need to understand the context:

1. When did this issue first appear?
   □ Just now / □ Today / □ Recently (past week) / □ Unclear

2. Is this affecting:
   □ Just you / □ Your team / □ All users / □ Production users

3. Has this code ever worked correctly?
   □ Yes, broke recently / □ No, new feature being developed / □ Don't know
```

### Error-Based Debugging
```
"I see you're getting an error. Let me gather some details:

1. What's the exact error message? [paste full message]

2. Where is the error appearing?
   □ Browser console
   □ Terminal/command line
   □ Application logs
   □ Error page shown to user
   □ Other: [specify]

3. Can you reproduce this error consistently?
   □ Every time / □ Sometimes / □ Just once / □ Unsure
```

### Performance Issues
```
"Performance issue noted. Let me understand the scope:

1. How slow is 'slow'?
   □ Seconds (1-10s) / □ Tens of seconds / □ Minutes / □ Times out

2. Was it always this slow?
   □ No, recently degraded / □ Yes, always been slow / □ Don't know

3. Is it slow for:
   □ All operations / □ Specific operations: [specify] / □ Random/intermittent
```

---

## Scope-Narrowing Questions

### Frontend Issues
```
"Let's narrow down the frontend issue:

1. Which browser(s) show this issue?
   □ All browsers / □ Chrome / □ Firefox / □ Safari / □ Edge / □ Mobile browser

2. Does this happen:
   □ On page load / □ After user action / □ After API response / □ Random timing

3. Do you see any errors in the browser console (F12)?
   □ Yes: [paste error] / □ No errors / □ Haven't checked yet
```

### Backend Issues
```
"Narrowing down the backend issue:

1. Which endpoint or function is affected?
   □ Specific: [endpoint/function name] / □ Multiple / □ All backend operations

2. Is the backend:
   □ Returning an error response / □ Timing out / □ Returning wrong data / □ Not responding

3. Have you checked the server logs?
   □ Yes, see error: [paste] / □ Yes, no errors visible / □ No, need help finding logs
```

### Database Issues
```
"Let's diagnose the database issue:

1. What's the database symptom?
   □ Slow queries / □ Connection failures / □ Wrong data / □ Errors on specific operations

2. Database type:
   □ PostgreSQL / □ MySQL / □ MongoDB / □ Redis / □ Other: [specify]

3. Is this affecting:
   □ One table/collection / □ Multiple tables / □ All database operations
```

---

## Diagnostic Validation Questions

### Before Forming Hypothesis
```
"I'm forming a hypothesis but need to validate:

Based on the symptoms, I suspect [hypothesis].

To confirm, can you tell me:
- [Specific question to validate hypothesis]
- [Specific question to rule out alternatives]

Example:
"I suspect a CORS issue. To confirm:
- Are the frontend and backend on different domains? (Y/N)
- Do you see a CORS-related error in the browser console? (Y/N)"
```

### Before Deep Investigation
```
"Before I dive deep into [area], let me make sure I'm investigating the right thing:

Quick verification:
1. Is [assumption] correct? (Y/N)
2. Have you ruled out [common alternative cause]? (Y/N)
3. Is there anything else that changed around the same time? (Y/N - if yes, describe)

This helps me avoid investigating down the wrong path."
```

---

## Solution Proposal Questions

### Before Implementing Fix
```
"I've identified the issue: [diagnosis]

Before I implement a fix, let me confirm:

1. Does this diagnosis align with what you expected?
   □ Yes, makes sense / □ Partially / □ No, unexpected / □ Unsure

2. Urgency level:
   □ Critical (production down) / □ High (blocking work) / □ Medium (annoying) / □ Low (minor)

3. Risk tolerance:
   □ Conservative (safest fix, even if takes longer)
   □ Balanced (good fix, reasonable time)
   □ Aggressive (fastest fix, can refine later)
```

### Fix Approach Selection
```
"I can fix this in multiple ways:

OPTION A: [Quick Fix]
- Time: [estimate]
- Pros: [benefits]
- Cons: [drawbacks]
- Best for: [scenario]

OPTION B: [Comprehensive Fix]
- Time: [estimate]
- Pros: [benefits]
- Cons: [drawbacks]
- Best for: [scenario]

Which approach fits your current needs?
□ Option A / □ Option B / □ Explain both in more detail / □ Suggest another approach
```

---

## Follow-Up & Verification Questions

### After Implementing Fix
```
"Fix implemented. Before closing this out:

1. Can you test if the issue is resolved?
   □ Will test now / □ Need help testing / □ Will test later

2. Should I add any preventive measures?
   □ Add tests / □ Add monitoring / □ Add documentation / □ No need

3. Is there anything related we should investigate while we're here?
   □ Yes: [describe] / □ No, this was the only issue
```

### After Testing
```
"Thanks for testing.

1. Test results:
   □ Issue completely resolved / □ Improved but not perfect / □ Still seeing issues

2. If not completely resolved:
   - What's still not working? [describe]
   - Same issue or different symptom? [specify]

3. Any new issues after the fix?
   □ No, all good / □ Yes: [describe]
```

---

## Escalation Questions

### When Stuck
```
"I've investigated [what you checked] but need more information to proceed.

To continue, I need:
- [Specific information needed]
- [Why this information is needed]

Options:
A) Can you provide this information?
B) Should I show you how to gather it?
C) Should we escalate to someone who has access to this?
D) Should I proceed with what we have (less certain)?

What would you prefer?"
```

### When Multiple Issues Found
```
"I found multiple issues:

ISSUE 1: [Description]
- Severity: [High/Medium/Low]
- Impact: [What it affects]

ISSUE 2: [Description]
- Severity: [High/Medium/Low]
- Impact: [What it affects]

ISSUE 3: [Description]
- Severity: [High/Medium/Low]
- Impact: [What it affects]

These might be related or independent.

How should we proceed?
□ Fix all now (estimated time: [X])
□ Fix [highest severity] now, others later
□ Investigate root cause linking them (might find one fix for all)
□ Your prioritization
```

---

## Template Usage Guidelines

### Customization
- Replace [placeholders] with context-specific details
- Add/remove checkbox options based on the situation
- Combine templates for complex scenarios

### Tone
- Adapt formality to your team's culture
- Add encouraging language for stressed situations ("Don't worry, we'll figure this out")
- Be concise under time pressure

### Sequencing
1. Start with Initial Context Questions
2. Move to Scope-Narrowing Questions
3. Use Diagnostic Validation Questions before investigating
4. Present Solution Proposal Questions before coding
5. End with Follow-Up & Verification Questions

### Anti-Patterns
❌ Asking too many questions at once (max 3-4)
❌ Asking open-ended questions when checkboxes would work
❌ Not explaining why you need the information
❌ Forgetting to wait for response before proceeding
```

---

## Summary

This guide provides the technical foundation for implementing interactive questions in Claude Code skills and agents for a debugging framework. The key takeaways are:

1. **Questions work through natural language instructions**, not API calls
2. **Skills pause execution naturally** when they output questions that require responses
3. **Context is preserved** through conversation history and optional file-based state
4. **Best practice is progressive questioning**: Start with 1-2 critical questions, build from there
5. **Subagents should be autonomous**; use the main agent for interactive questions
6. **Decision trees are implemented declaratively** through conditional instructions in SKILL.md
7. **The skill-creator pattern is the gold standard**: Ask questions, validate understanding, then proceed

The example skills demonstrate how to build sophisticated interactive debugging workflows that gather context before taking action, significantly improving the accuracy and effectiveness of AI-assisted debugging.
