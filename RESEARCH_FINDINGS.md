# Interactive Questions Research: Detailed Findings & Resources

This document contains detailed research findings, resources, and technical references for implementing interactive questions in Claude Code.

---

## Key Research Findings

### 1. No Explicit Pause API

**Critical Discovery**: Claude Code and the Claude Agent SDK do not provide an explicit "pause" or "waitForInput" API. Instead, interactive questions work through:

- **Natural Language Prompting**: Instructions in SKILL.md tell Claude to ask questions
- **Conversational Turns**: Claude's response ends after asking, naturally pausing execution
- **Context Continuation**: Next user message continues from where the agent left off

**Source**: Multiple documentation sources and community discussions confirm this pattern.

### 2. The `pause_turn` Stop Reason

**Finding**: The Claude API includes a `pause_turn` stop reason mentioned in documentation:
- Used with server tools like web search when Claude needs to pause long-running operations
- Can be handled in loops to continue conversations after pausing
- Not the primary mechanism for skills asking questions (that's done through natural language)

**Source**: Anthropic API documentation on handling stop reasons

### 3. Skill-Creator as Reference Implementation

**Key Discovery**: The `skill-creator` skill from Anthropic's official skills repository serves as the reference implementation for interactive questioning:

**How it Works**:
1. Asks about skill purpose and functionality
2. Avoids overwhelming with too many questions at once
3. Uses progressive questioning: "Start with the most important questions and follow up as needed"
4. Concludes when there's "a clear sense of the functionality the skill should support"

**Pattern Used**:
```markdown
If you need more information from me, ask me 1-2 key questions right away.
```

This simple instruction is sufficient for Claude to pause and ask questions.

**Source**: github.com/anthropics/skills - skill-creator skill

### 4. Subagent Interactive Question Limitations

**Issue Discovered**: GitHub Issue #7091 - "If sub-agent asks user to approve an edit, it gets stuck indefinitely"

**Implication**: Subagents can technically ask questions but may experience issues with approval workflows.

**Recommended Pattern**:
- Main agent: Interactive, asks questions
- Subagents: Autonomous, report findings to main agent
- Main agent: Asks user questions based on subagent findings

**Source**: github.com/anthropics/claude-code/issues/7091

### 5. Claude's Question-Asking Behavior Challenge

**Issue Discovered**: GitHub Issue #742 - "Claude Doesn't Follow Instructions"

**Problem**: Claude sometimes ignores instructions to pause and ask questions before proceeding, immediately starting tool use and file analysis.

**Mitigation Strategies**:
1. Use very explicit language: "STOP. Before doing anything else, ask me..."
2. Repeat the instruction multiple times in the prompt
3. Use formatting (bold, caps) to emphasize the pause instruction
4. Include negative examples: "Do NOT read files before asking these questions"

**Source**: github.com/anthropics/claude-code/issues/742

### 6. Interactive Pattern from Deep Research Prompt

**Discovery**: Community-created prompts show effective question-asking patterns:

**When to Ask**:
- Query is very short
- Don't fully understand what user is asking
- Query has multiple valid interpretations
- Key context is missing
- Query is extremely broad
- Specific preferences/constraints are unclear

**Critical Rule**: "If you ask clarifying questions, then wait for the user's response — don't start the research immediately."

**Source**: GitHub Gist - Custom Deep Research prompt for Claude

### 7. Official Anthropic Prompt Engineering Guidance

**Key Recommendations**:
1. Include instructions like: "If you need more information from me, ask me 1-2 key questions right away"
2. Add: "If you think I should upload any documents that would help you do a better job, let me know"
3. Build in acknowledgment of uncertainty: "Say 'I don't know' if unsure"

**Pattern**: This appears in multiple official Anthropic example prompts for various tasks.

**Source**: Anthropic prompt engineering documentation and examples

### 8. Progressive Disclosure Principle

**Core Pattern**: Agent Skills use "progressive disclosure" - loading information only as needed rather than all upfront.

**Application to Questions**:
- Don't ask all possible questions upfront
- Ask the minimum needed to start
- Ask follow-up questions based on initial answers
- This prevents overwhelming users and keeps conversations focused

**Source**: Multiple sources including Anthropic engineering blog on Agent Skills

### 9. Extended Thinking for Complex Planning

**Discovery**: Claude Code Best Practices recommend using extended thinking for complex scenarios:

**Commands**:
- "think" - basic extended thinking
- "think hard" - more computation budget
- "think harder" - even more thorough
- "ultrathink" - maximum evaluation of alternatives

**Application**: Before asking questions, you can use extended thinking to determine what questions are most important.

**Source**: anthropic.com/engineering/claude-code-best-practices

### 10. Permission-Based Collaboration Pattern

**Pattern**: Claude Code requests permission before system-modifying actions (file writes, bash commands).

**Relevance**: This is a form of interactive questioning built into Claude Code's core behavior.

**Application**: Your debugging skills can follow the same pattern - present analysis, ask permission to fix.

**Source**: Claude Code Best Practices documentation

---

## Architecture Patterns

### Pattern 1: Question-First Skill

```yaml
---
name: question-first-skill
description: Always asks questions before taking action
---

# Question-First Skill

## First Action: ALWAYS ASK

Before doing ANYTHING else (reading files, running commands, analyzing code):

Ask the user:
1. [Most critical question]
2. [Second most critical question]

Wait for their response.

## After Response

Based on their answers, proceed with investigation.
```

### Pattern 2: Checkpoint Pattern

```markdown
## Investigation with Checkpoints

Phase 1: Initial Analysis
[Do read-only operations]

CHECKPOINT 1: Present findings and ask: "Should I investigate [A] or [B] first?"

Phase 2: Deep Dive
[Based on user choice, investigate selected path]

CHECKPOINT 2: Present diagnosis and ask: "Does this match your expectations?"

Phase 3: Solution
[Propose fixes]

CHECKPOINT 3: Ask: "Which solution should I implement?"

Phase 4: Implementation
[Make changes]

CHECKPOINT 4: Ask: "Ready to commit?"
```

### Pattern 3: Decision Tree State Machine

```markdown
## State Machine Pattern

States: GATHERING → ANALYZING → DIAGNOSING → PROPOSING → IMPLEMENTING → VERIFYING

Transitions:
- GATHERING → ANALYZING: After collecting answers to initial questions
- ANALYZING → DIAGNOSING: After understanding the problem space
- DIAGNOSING → GATHERING: If need more info
- DIAGNOSING → PROPOSING: If root cause found
- PROPOSING → IMPLEMENTING: After user chooses solution
- IMPLEMENTING → VERIFYING: After changes made
- VERIFYING → GATHERING: If verification reveals new issues

At each state transition, log the transition and reason in a state.log file.
```

### Pattern 4: Context Accumulation

```markdown
## Building Context Across Questions

Create a context document that grows with each Q&A:

```json
{
  "session": {
    "started": "2025-11-13T10:00:00Z",
    "issue_type": "determined_from_Q1",
    "severity": "determined_from_Q2",
    "affected_components": ["determined_from_Q3"]
  },
  "facts_gathered": [
    {"question": "Q1", "answer": "A1", "insight": "Issue is in backend"},
    {"question": "Q2", "answer": "A2", "insight": "Started after deployment"}
  ],
  "hypotheses": [
    {"hypothesis": "Database connection pool", "status": "investigating"},
    {"hypothesis": "Cache invalidation", "status": "ruled_out"}
  ],
  "next_questions": [
    "What changed in the deployment?"
  ]
}
```

Update this file after each Q&A cycle.
Read it at the start of each response to maintain context.
```

### Pattern 5: Human-in-the-Loop (HITL)

```markdown
## HITL Pattern for Subagents

Main Agent: Interactive coordinator
Subagents: Autonomous investigators

Flow:
1. User describes problem to Main Agent
2. Main Agent asks clarifying questions
3. Main Agent invokes Subagent with clear instructions
4. Subagent investigates autonomously (no questions)
5. Subagent returns findings to Main Agent
6. Main Agent asks user about findings ("I found X, Y, Z. Which should I investigate deeper?")
7. Main Agent invokes another Subagent based on user response
8. Repeat until resolution

This keeps questions at the Main Agent level while using Subagents for parallel investigation.
```

---

## Technical Implementation Details

### SKILL.md Frontmatter Options

```yaml
---
name: skill-name                    # Required: lowercase, hyphens, max 64 chars
description: What and when to use   # Required: max 1024 chars, no XML tags
allowed-tools: Read, Grep, Bash     # Optional: Pre-approved tools (Claude Code only)
license: MIT                        # Optional: License terms
metadata:                           # Optional: Custom key-value pairs
  category: debugging
  version: 1.0.0
  author: your-name
---
```

**Note on allowed-tools**:
- When specified, Claude can use these tools without asking permission
- Useful for autonomous subagents
- Security consideration: Be restrictive for skills that run unsupervised

### Skill Directory Structure

```
.claude/skills/your-skill-name/
├── SKILL.md                 # Required: Instructions and prompts
├── scripts/                 # Optional: Executable scripts
│   ├── analyze.py
│   └── fix.sh
├── references/              # Optional: Documentation loaded into context
│   ├── patterns.md
│   └── examples.md
└── assets/                  # Optional: Templates and binary files
    ├── template.json
    └── diagram.png
```

**Progressive Disclosure**: Keep SKILL.md under 500 lines. If longer, split into references/ files and load on demand.

### Question Templates in SKILL.md

**Multiple Choice Pattern**:
```markdown
Ask: "Which applies?"
A) Option one
B) Option two
C) Option three
D) None of the above

Wait for user to choose A, B, C, or D.
```

**Numbered Questions Pattern**:
```markdown
I need to know:
1. First critical piece of information
2. Second critical piece of information
3. Third critical piece of information

Please answer all three.
```

**Yes/No Decision Pattern**:
```markdown
Before I [action], I need to confirm:
- Is [assumption] correct? (Y/N)
- Should I [action]? (Y/N)

Please respond Y or N for each.
```

**Fill-in-the-Blank Pattern**:
```markdown
Please provide:
- Error message: [paste here]
- Timestamp: [when did it occur]
- Affected users: [how many / which ones]
```

### Agent SDK Conversation Handling

**For Custom Agents** (not skills):

```python
from anthropic import Anthropic

client = Anthropic()

# Initial message with instructions to ask questions
messages = [
    {
        "role": "user",
        "content": "Debug my application. Before starting, ask me 2-3 clarifying questions."
    }
]

# Agent will respond with questions
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=4096,
    messages=messages
)

print(response.content[0].text)  # Will contain questions

# User provides answers
messages.append({"role": "assistant", "content": response.content[0].text})
messages.append({
    "role": "user",
    "content": "Answer 1: ...\nAnswer 2: ...\nAnswer 3: ..."
})

# Continue conversation
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=4096,
    messages=messages
)
```

**Key Point**: In the Agent SDK, you manage the message array manually. Each question-answer cycle is a turn in the messages array.

---

## Best Practices from Research

### 1. Question Quality

**Do**:
- Ask specific, targeted questions
- Provide context for why you're asking
- Offer multiple choice when possible
- Number questions for easy reference
- Limit to 2-3 questions per turn

**Don't**:
- Ask open-ended "tell me everything" questions
- Ask questions you could answer by reading code/logs
- Overwhelm with 10+ questions at once
- Ask questions without explaining their purpose
- Make assumptions instead of asking

### 2. Progressive Questioning

**Pattern**:
```
Turn 1: Critical context (1-2 questions)
Turn 2: Scope narrowing (2-3 questions based on Turn 1 answers)
Turn 3: Validation (confirm hypothesis formed from Turns 1-2)
Turn 4: Solution preference (which fix approach)
```

**Rationale**: Each turn builds on previous answers, avoiding wasted questions.

### 3. Explicit State Management

**Why**: Helps both the AI and user track where you are in the debugging process.

**How**:
```markdown
Current State: ANALYZING (Phase 2/5)
Previous: GATHERING (collected error message, reproduction steps)
Next: DIAGNOSING (will form hypothesis based on analysis)

Now analyzing the error message you provided...
```

### 4. Acknowledgment Pattern

**Always acknowledge the user's answer before proceeding**:

```markdown
"Got it - you said [summarize answer].

Based on that, I'll [state next action].

[Proceed with next action]"
```

**Why**: Confirms you understood correctly and gives user a chance to correct misunderstandings.

### 5. Transparent Reasoning

**Show your thought process**:

```markdown
"You mentioned this started after the deployment.

This tells me:
- The code was working before
- Something in the deployment changed behavior
- Likely a code change, config change, or dependency update

Given that, my best approach is to check the git diff from that deployment.

[Execute git commands]"
```

**Why**: User can course-correct if your reasoning is wrong.

### 6. Risk-Based Questioning

**High-risk scenarios** (production down, data at risk, financial impact):
- Ask fewer questions, act faster
- Ask ONLY critical questions
- State assumptions explicitly: "I'm assuming X; correct me if wrong"

**Low-risk scenarios** (dev environment, exploratory debugging):
- Can ask more detailed questions
- Can explore multiple paths
- Can be more thorough

**Example**:
```markdown
I see this is affecting production users right now.

Given the urgency, I'll ask only the most critical question:
- Do you want me to find a quick fix now, or root cause investigation?

I'm assuming this is on AWS (based on logs), using PostgreSQL (based on errors), and started within the past hour. Correct me if any of those are wrong, otherwise I'll proceed with that context.
```

### 7. Escape Hatches

**Always provide escape hatches** in your questions:

```markdown
Ask: "Should I investigate A, B, or C first?"

But include:
D) Investigate all three in parallel
E) Something else (describe)
F) I'm not sure, you decide
```

**Why**: User might not have enough context to choose, or might want a different approach entirely.

### 8. Documentation of Decisions

**Record Q&A decisions** for future reference:

```markdown
## Decision Log

**Question**: Should I focus on quick fix or root cause?
**Answer**: Quick fix for now
**Implication**: Will implement workaround, create follow-up task for proper fix
**Decided at**: 2025-11-13 10:45

**Question**: Which environment to test in first?
**Answer**: Staging
**Implication**: Will deploy to staging, verify, then production
**Decided at**: 2025-11-13 10:50
```

**Why**: Provides audit trail and context for future debugging sessions.

---

## Community Resources & Examples

### Official Anthropic Resources

1. **Skills Repository**: github.com/anthropics/skills
   - skill-creator: Reference implementation for interactive skills
   - template-skill: Starting point for custom skills

2. **Claude Agent SDK**: github.com/anthropics/claude-agent-sdk-python
   - Examples of conversation handling
   - Tool use patterns

3. **Anthropic Engineering Blog**:
   - "Building agents with the Claude Agent SDK"
   - "Claude Code Best Practices"
   - "Equipping agents for the real world with Agent Skills"

### Community Skills

1. **obra/superpowers**: github.com/obra/superpowers
   - systematic-debugging: 4-phase root cause process
   - root-cause-tracing: Finding the real problem
   - brainstorming: Socratic design refinement (interactive)

2. **VoltAgent/awesome-claude-code-subagents**: github.com/VoltAgent/awesome-claude-code-subagents
   - 100+ specialized subagents
   - Production-ready examples

3. **diet103/claude-code-infrastructure-showcase**: github.com/diet103/claude-code-infrastructure-showcase
   - Skill auto-activation examples
   - Hooks and agents infrastructure

### Educational Resources

1. **"Claude Agent Skills: A First Principles Deep Dive"**
   - leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/
   - Comprehensive technical analysis

2. **"Inside Claude Code Skills: Structure, prompts, invocation"**
   - mikhail.io/2025/10/claude-code-skills/
   - Technical deep dive on how skills work

3. **Simon Willison's Blog**: "Claude Skills are awesome, maybe a bigger deal than MCP"
   - High-level overview and implications

### Interactive Prompt Examples

1. **Custom Deep Research Prompt**:
   - Gist by XInTheDark showing clarifying question patterns

2. **Official Anthropic Prompt Examples**:
   - Multiple examples in documentation showing "ask me questions" pattern

---

## Debugging Framework Application

### Framework Architecture Using Interactive Questions

```
┌─────────────────────────────────────────┐
│         Main Debugging Agent            │
│  (Interactive - Asks User Questions)    │
└──────────────┬──────────────────────────┘
               │
               ├── Phase 1: GATHER CONTEXT
               │   • Ask: Issue type, severity, context
               │   • Create: debug-session.json
               │
               ├── Phase 2: DIAGNOSTIC TRIAGE
               │   • Ask: Which layer (frontend/backend/db)
               │   • Route to appropriate subagent
               │
               ├── Phase 3: INVESTIGATION
               │   ├── Frontend Subagent (autonomous)
               │   ├── Backend Subagent (autonomous)
               │   ├── Database Subagent (autonomous)
               │   └── Smart Contract Subagent (autonomous)
               │   │
               │   └── Each returns findings to Main Agent
               │
               ├── Phase 4: HYPOTHESIS FORMATION
               │   • Present findings to user
               │   • Ask: "I found X, Y, Z. Which to investigate deeper?"
               │   • Form diagnosis
               │
               ├── Phase 5: SOLUTION PROPOSAL
               │   • Ask: "Fix approach A, B, or C?"
               │   • Get user choice
               │
               └── Phase 6: IMPLEMENTATION & VERIFICATION
                   • Implement chosen solution
                   • Ask: "Tests pass. Commit changes?"
```

### Skill Organization for Debugging Framework

```
.claude/skills/
├── web3-debugging-coordinator/        # Main interactive skill
│   ├── SKILL.md                       # Handles all user questions
│   └── question-templates.md
│
├── frontend-debugger/                 # Autonomous subagent skill
│   ├── SKILL.md                       # No questions, just investigate
│   └── scripts/analyze-react.js
│
├── backend-debugger/                  # Autonomous subagent skill
│   ├── SKILL.md
│   └── scripts/analyze-logs.py
│
├── blockchain-debugger/               # Autonomous subagent skill
│   ├── SKILL.md
│   └── scripts/analyze-transaction.js
│
└── database-debugger/                 # Autonomous subagent skill
    ├── SKILL.md
    └── scripts/analyze-queries.sql
```

### Main Coordinator Skill Pattern

**File: `.claude/skills/web3-debugging-coordinator/SKILL.md`**

```yaml
---
name: web3-debugging-coordinator
description: Main coordinator for Web3 debugging that asks clarifying questions and delegates to specialist subagents
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Web3 Debugging Coordinator

This is the MAIN SKILL for all Web3 debugging.
It asks users questions and coordinates subagents.

## Role
- Interactive questioner (talks to user)
- Context gatherer
- Hypothesis validator
- Solution proposer

## Does NOT do
- Low-level investigation (delegates to subagents)
- Autonomous debugging (always asks before proceeding)

## Workflow
1. Ask initial questions
2. Create debug-session.json
3. Delegate to appropriate subagent skills
4. Present subagent findings
5. Ask follow-up questions
6. Propose solutions
7. Get user approval
8. Coordinate implementation

[Rest of skill implementation]
```

### Specialist Subagent Skill Pattern

**File: `.claude/skills/blockchain-debugger/SKILL.md`**

```yaml
---
name: blockchain-debugger
description: Autonomous blockchain transaction and smart contract debugger. Reports findings without user interaction.
allowed-tools: Read, Bash, Grep
---

# Blockchain Debugger (Autonomous Subagent)

This is a SUBAGENT skill. It does NOT ask user questions.
It investigates and reports findings.

## Role
- Analyze blockchain transactions
- Decode contract interactions
- Trace transaction execution
- Report findings in structured format

## Output Format
Always produce a structured report:

```json
{
  "analysis_type": "transaction_failure | contract_bug | gas_issue | etc",
  "severity": "critical | high | medium | low",
  "findings": [
    {
      "type": "root_cause | contributing_factor | observation",
      "description": "...",
      "evidence": "...",
      "confidence": "high | medium | low"
    }
  ],
  "recommendations": [
    {
      "action": "...",
      "effort": "5min | 30min | etc",
      "risk": "low | medium | high",
      "priority": 1
    }
  ],
  "questions_for_user": [
    "If you need user input, list questions here",
    "Main coordinator will ask them"
  ]
}
```

[Rest of skill implementation]
```

---

## Advanced Patterns

### Pattern: Confidence-Based Questioning

```markdown
## Adjust questioning based on confidence

High Confidence (>90%):
"I'm very confident the issue is [X].

Should I proceed with the fix, or would you like me to explain my reasoning first?"

Medium Confidence (50-90%):
"I think the issue is [X] (confidence: ~70%).

To confirm, can you tell me:
- [Validation question 1]
- [Validation question 2]"

Low Confidence (<50%):
"I've narrowed it down to three possibilities:
A) [Hypothesis A] - 35% confidence
B) [Hypothesis B] - 30% confidence
C) [Hypothesis C] - 25% confidence

Which should I investigate first? Or should I investigate all three in parallel?"
```

### Pattern: Time-Bounded Investigation

```markdown
## When debugging under time pressure

"I understand this is urgent. Here's my approach:

PHASE 1 (5 minutes): Quick investigation
- Check [most likely causes]
- If found: propose quick fix
- If not found: proceed to Phase 2

PHASE 2 (15 minutes): Deeper investigation
- Check [less common causes]
- Run diagnostic scripts
- If found: propose fix
- If not found: proceed to Phase 3

PHASE 3 (30+ minutes): Comprehensive investigation
- Full system analysis
- Consider edge cases
- May need additional tools/access

I'll report back after each phase. If we find the issue early, we save time.

Should I proceed with this approach?"
```

### Pattern: Evidence-Based Confidence

```markdown
## Show evidence for your conclusions

"DIAGNOSIS: Database connection pool exhaustion

EVIDENCE:
✓ Strong: Error message "pool timeout after 30s" (direct indicator)
✓ Strong: Connection pool size is 5, but 20+ concurrent requests (math checks out)
✓ Medium: Issue started after deployment (correlation in timing)
✓ Weak: CPU usage is high (could be symptom or unrelated)

CONFIDENCE: High (85%)

ALTERNATIVE HYPOTHESES RULED OUT:
✗ Database server down → ping successful
✗ Wrong credentials → other apps connect fine
✗ Network issue → latency is normal

Does this diagnosis align with what you're seeing?"
```

### Pattern: Collaborative Hypothesis Formation

```markdown
## Involve user in forming hypothesis

"Let me share what I've found so far:

SYMPTOMS OBSERVED:
- Checkout API returns 500 errors
- Database shows slow query warnings
- Issue started 30 minutes ago
- Affects ~30% of requests

RECENT CHANGES:
- Deployment 35 minutes ago
- Added new filter to orders query
- No infrastructure changes

MY HYPOTHESIS:
The new query filter is causing slow queries, leading to timeouts and 500 errors.

YOUR TURN:
Does this hypothesis make sense to you?
Do you have any other information that might support or refute this?
Is there anything I'm missing?"
```

---

## Troubleshooting Interactive Questions

### Problem: Claude Ignores "Ask First" Instructions

**Symptoms**: Claude immediately starts using tools despite instruction to ask questions first.

**Solutions**:
1. **Be extremely explicit**:
   ```markdown
   STOP. DO NOT use any tools yet.
   DO NOT read any files yet.
   DO NOT analyze anything yet.

   FIRST, ask me these questions:
   1. [Question]
   2. [Question]

   Only after I answer should you begin investigation.
   ```

2. **Use formatting**:
   ```markdown
   ⚠️ **IMPORTANT**: Before investigating, ask questions!

   **DO THIS FIRST**:
   - Ask about [X]
   - Ask about [Y]

   **DO NOT DO THIS YET**:
   - Do not read files
   - Do not run commands
   ```

3. **Repeat the instruction**:
   ```markdown
   [At the start of SKILL.md]
   Always ask questions before investigating.

   [In the middle of SKILL.md]
   Remember: Ask questions first.

   [At the end of SKILL.md]
   Critical rule: Never skip the questioning phase.
   ```

### Problem: Questions Are Too Vague

**Symptoms**: User doesn't know how to answer your questions.

**Solution**: Provide structure and examples:
```markdown
BAD: "Tell me about the error"

GOOD: "Please describe the error:
- Exact error message: [paste here]
- Where it appears: [console / UI / logs]
- When it happens: [always / sometimes / once]

Example of good answer:
'Error: Database timeout after 30s'
Appears in: Application logs
Happens: Every time I call /api/checkout"
```

### Problem: Too Many Questions at Once

**Symptoms**: User gets overwhelmed, answers incompletely.

**Solution**: Progressive questioning:
```markdown
PHASE 1 (Start here):
"Quick question: Is this a frontend or backend issue?"

PHASE 2 (After answer):
[If backend] "Which backend component?"
[If frontend] "Which page or component?"

PHASE 3 (After answer):
[More specific questions based on previous answers]
```

### Problem: Losing Context Between Questions

**Symptoms**: Claude forgets previous answers or asks same question twice.

**Solution**: Maintain explicit context:
```markdown
After each answer, create/update debug-context.md:

```markdown
# Debug Session Context

## Answers Collected
1. Issue type: Backend API error
2. Affected endpoint: /api/v1/orders
3. Started: After yesterday's deployment
4. Severity: Production-critical

## Next Questions
- What changed in yesterday's deployment?

## Hypotheses Formed
- Likely a code or config change from deployment
```

Reference this file at the start of each response:
"Checking our session context... You previously said this is a backend API error affecting /api/v1/orders..."
```

---

## Conclusion

Interactive questions in Claude Code work through **declarative instructions** in SKILL.md files, not through explicit API calls. The key is:

1. **Tell Claude when to ask** through clear instructions
2. **Structure questions** for easy answering (multiple choice, numbered, etc.)
3. **Acknowledge answers** before proceeding
4. **Build context progressively** through multi-turn conversations
5. **Show transparent reasoning** so users can course-correct
6. **Use files for complex state** that needs to persist across turns
7. **Keep main agents interactive**, subagents autonomous
8. **Follow progressive disclosure** - ask minimum needed, build from there

The research shows this pattern is well-established in the Claude ecosystem and is the recommended approach for building sophisticated, user-friendly debugging workflows.

---

## Additional Resources to Explore

1. **Anthropic's Interactive Prompt Engineering Tutorial**: github.com/anthropics/prompt-eng-interactive-tutorial
2. **Claude Code Common Workflows**: docs.claude.com/en/docs/claude-code/common-workflows
3. **Agent Skills Best Practices**: docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices
4. **Community Discord/Slack**: For real-time discussions about skill patterns
5. **GitHub Issues**: anthropics/claude-code repository for known issues and workarounds
