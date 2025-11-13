# Blockchain Web3 Specialist Framework

A comprehensive framework with skills, agents, subagents and MCPs for blockchain Web3 management, featuring **interactive question-based debugging** as the core methodology.

## Overview

This framework implements a systematic approach to Web3 debugging using Claude Code's Agent Skills with interactive questioning at its core. Rather than making assumptions, the framework asks targeted questions to gather context before investigating, leading to more accurate diagnoses and better solutions.

## Documentation

### Core Guides

1. **[INTERACTIVE_QUESTIONS_GUIDE.md](./INTERACTIVE_QUESTIONS_GUIDE.md)** - Complete technical guide
   - Technical implementation of interactive questions
   - Best practices for questioning workflows
   - Integration with skills and agents
   - Comprehensive code examples

2. **[IMPLEMENTATION_QUICKSTART.md](./IMPLEMENTATION_QUICKSTART.md)** - Get started in 5 minutes
   - Copy-paste ready skill implementations
   - Step-by-step setup instructions
   - Testing scenarios and troubleshooting
   - Quick reference patterns

3. **[RESEARCH_FINDINGS.md](./RESEARCH_FINDINGS.md)** - Deep dive and resources
   - Detailed research findings
   - Architecture patterns
   - Community resources
   - Advanced techniques

## Key Features

### Interactive Question-Based Debugging

- **Context-First Approach**: Gather complete context through targeted questions before investigating
- **Progressive Questioning**: Start with critical questions, build understanding iteratively
- **Decision Tree Workflows**: Systematic narrowing of issue scope through structured questions
- **User-Guided Investigation**: Let users direct the investigation based on their priorities

### Web3-Specific Skills

- Smart contract debugging with safety checks
- Transaction failure analysis
- Gas estimation issue diagnosis
- Multi-chain support (Ethereum, L2s, local networks)
- Wallet connection troubleshooting

### Multi-Layer Debugging

- Frontend (React, Vue, browser issues)
- Backend (API, server, business logic)
- Database (queries, connections, performance)
- Blockchain (transactions, contracts, network)

## Quick Start

### 1. Install a Basic Interactive Debugging Skill

```bash
# Create the skills directory
mkdir -p .claude/skills/interactive-debugger

# Copy the basic interactive debugging skill
# See IMPLEMENTATION_QUICKSTART.md for the full content
```

### 2. Test It

Start a Claude Code session and report an issue:

```
You: "I'm getting an error in my app"

Claude: "I'll help debug this. First, let me understand the context:

1. What type of issue?
   A) Error message / exception
   B) Wrong behavior / bug
   C) Performance problem
   D) Build / deployment failure
..."
```

### 3. Customize for Your Needs

Modify the questions in SKILL.md to match your specific debugging scenarios.

## Architecture

```
Interactive Debugging Framework
│
├── Main Coordinator (Interactive)
│   ├── Asks user questions
│   ├── Gathers context
│   ├── Routes to specialists
│   └── Proposes solutions
│
├── Specialist Subagents (Autonomous)
│   ├── Frontend Debugger
│   ├── Backend Debugger
│   ├── Database Debugger
│   └── Blockchain Debugger
│
└── Supporting Skills
    ├── Question Templates
    ├── Decision Trees
    └── Context Management
```

## Core Principles

1. **Never Assume**: Always ask when there's ambiguity
2. **Question First, Investigate Second**: Gather context before diving into code
3. **Progressive Disclosure**: Start broad, narrow based on answers
4. **Transparent Reasoning**: Show why you're asking each question
5. **User Empowerment**: Let users guide the investigation
6. **Evidence-Based**: Support conclusions with concrete evidence
7. **Safety First**: Especially for smart contract modifications

## Example Session

```
User: "My checkout is broken"

Agent: "I'll help fix the checkout. Quick context:
1. Are users seeing an error, or just wrong behavior?
2. Is this affecting production right now?
3. When did this start?"

User: "1. They see 'Payment failed' error
2. Yes, production is down
3. Started about 30 minutes ago"

Agent: "Got it - 'Payment failed' error in production, started 30 min ago.

Given production is down, I'll focus on quick diagnosis.
Let me check:
- Recent deployments
- Payment service logs
- Database connections

[Investigates]

Found it! Deployment 35 minutes ago changed payment API endpoint.
The endpoint is returning 404 because the route wasn't updated.

OPTION A: Rollback deployment (2 min) - safest
OPTION B: Fix the route (5 min) - keeps new features

Which do you prefer?"

User: "A - rollback"

Agent: "Rolling back now...
[Executes rollback]
✓ Complete. Checkout should be working now.
Can you verify?"
```

## Documentation Structure

### For Implementers
- Start with: **IMPLEMENTATION_QUICKSTART.md**
- Reference: **INTERACTIVE_QUESTIONS_GUIDE.md** (Section 4: Code Examples)

### For Architects
- Start with: **INTERACTIVE_QUESTIONS_GUIDE.md** (Sections 1-2)
- Deep dive: **RESEARCH_FINDINGS.md** (Architecture Patterns)

### For Researchers
- Start with: **RESEARCH_FINDINGS.md**
- Reference: **INTERACTIVE_QUESTIONS_GUIDE.md** (Technical Implementation)

## Technical Highlights

### How It Works

Interactive questions in Claude Code work through **declarative instructions** in SKILL.md files:

```markdown
## Always Ask First

Before investigating, ask:
1. [Critical question]
2. [Critical question]

Wait for user response.
```

No explicit API - Claude naturally pauses when asking questions, waiting for user input.

### Context Preservation

```bash
# Create context file
cat > debug-session.json << 'EOF'
{
  "questions_asked": [],
  "answers": [],
  "hypotheses": [],
  "phase": "GATHERING"
}
EOF

# Update after each Q&A
jq '.answers += ["user said X"]' debug-session.json > tmp.json
mv tmp.json debug-session.json
```

### Decision Trees

Implemented through conditional instructions:

```markdown
If user chooses A:
  → Ask questions [X, Y]
If user chooses B:
  → Ask questions [P, Q]
```

## Use Cases

- **Smart Contract Debugging**: Ask about network, transaction, and recent changes before analyzing
- **DApp Troubleshooting**: Distinguish between frontend, backend, wallet, or blockchain issues
- **Performance Optimization**: Understand what's slow and why before profiling
- **Production Incidents**: Quick triage questions to route to right investigation
- **Code Review**: Ask about intent and requirements before suggesting changes

## Contributing

This framework is designed to be extended. Common additions:

- New specialist debugger skills for specific frameworks
- Additional question templates for your domain
- Custom decision trees for your architecture
- Integration with your monitoring/logging tools

## Best Practices

1. **Limit to 2-3 questions per turn** - Avoid overwhelming users
2. **Use multiple choice when possible** - Easier than free-form
3. **Acknowledge every answer** - Confirm understanding before proceeding
4. **Show confidence levels** - "I'm 90% confident this is X"
5. **Provide escape hatches** - Always include "other" or "not sure" options
6. **Create explicit memory** - Use context files for complex sessions
7. **Be transparent** - Explain why you're asking each question

## Resources

- **Anthropic Skills Repository**: github.com/anthropics/skills
- **Claude Agent SDK**: github.com/anthropics/claude-agent-sdk-python
- **Community Skills**: Multiple repositories listed in RESEARCH_FINDINGS.md

## License

[Your chosen license]

## Support

For issues or questions:
- Check IMPLEMENTATION_QUICKSTART.md for common problems
- Review INTERACTIVE_QUESTIONS_GUIDE.md for technical details
- See RESEARCH_FINDINGS.md for advanced patterns

---

Built with Claude Code Agent Skills - Making debugging a conversation, not a guessing game.
