# BlockchainOrchestra Framework - Master Orchestrator

## 🎯 Framework Overview

This is a **Documentation-Driven Context Persistence (DDCP)** framework for blockchain/Web3 development. It orchestrates Claude Skills, Subagents, and MCPs to maintain context across complex multi-chain projects.

**Core Philosophy**: Every action updates documentation to preserve context. When you jump between tasks days or weeks later, the framework maintains perfect state continuity.

---

## 📊 Current Project Status

**Project Name**: [Not yet initialized - waiting for first project]

**Current Phase**: `INITIALIZATION`
- [ ] Planning
- [ ] Development
- [ ] Auditing
- [ ] Deployment
- [ ] Maintenance

**Active Tasks**: None

---

## 🧠 Context Architecture

### Primary Context Files (Always Check These)

1. **context/PROJECT_STATE.md** - Current development status, completed features, pending tasks
2. **context/ARCHITECTURE.md** - System design decisions, contract structure, integration patterns
3. **context/DEPLOYMENT_STATE.md** - Multi-chain deployment tracking across networks
4. **context/SECURITY_LOG.md** - Security audit findings, vulnerability remediation status
5. **context/TESTING_STATUS.md** - Test coverage, TDD compliance, test results
6. **context/DECISIONS.md** - Architecture Decision Records (ADRs), rationale for key choices

### How Context Preservation Works

```
User Request
    ↓
Orchestrator (You) analyzes → Loads relevant context files
    ↓
Delegates to Subagent → Subagent reads context files
    ↓
Subagent executes task → Updates relevant context files
    ↓
Returns summary to Orchestrator → Context persisted for future use
```

**CRITICAL RULE**: Every subagent MUST update context files after completing work. This ensures context is never lost.

---

## 🤖 Agent Activation Rules

### Automatic Skill Activation (Progressive Loading)

**File-based triggers:**
- `.sol`, `.vy` files → Load `evm-expert` skill
- `.rs` files in `programs/` → Load `solana-expert` skill
- `.tsx`, `.jsx` files → Load `react-web3` skill

**Keyword-based triggers:**
- "security", "audit", "vulnerability" → Load `audit-methodology` skill
- "deploy", "testnet", "mainnet" → Load `deployment` skills
- "gas", "optimization" → Load `gas-optimizer` skill
- "test", "TDD", "coverage" → Load `tdd-smart-contracts` skill

### Subagent Delegation (Task-based)

**When to use subagents:**
- Complex tasks requiring isolated context (contract development, security audits)
- Parallel execution needed (frontend + backend simultaneously)
- Heavy token usage tasks (keeps main conversation focused)

**Available Subagents:**
- `contract-developer` - EVM smart contract development with TDD
- `solana-developer` - Solana/Rust program development
- `security-auditor` - Automated security analysis using free tools
- `frontend-developer` - dApp UI with Web3 integration
- `deployment-manager` - Multi-chain deployment orchestration
- `documentation-writer` - Auto-generate comprehensive docs
- `debugger` - Error analysis and resolution

---

## 🌐 Multi-Chain Configuration

### Supported Blockchains

**Primary Chains:**
- **Ethereum** (EVM) - Framework: Hardhat, Language: Solidity
- **Solana** - Framework: Anchor, Language: Rust
- **BSC** (EVM) - Framework: Hardhat, Language: Solidity
- **Avalanche** (EVM) - Framework: Hardhat, Language: Solidity

### Chain Selection Strategy

```
EVM-compatible chains (Ethereum, BSC, Avalanche):
    → Use evm-expert skill
    → Use Hardhat framework
    → Share contract code with minimal modifications

Solana:
    → Use solana-expert skill
    → Use Anchor framework
    → Separate Rust implementation
```

**See**: `context/DEPLOYMENT_STATE.md` for current deployment status across chains.

---

## 🛠️ Development Workflow Philosophy

### 1. Test-Driven Development (TDD) - ENFORCED

**Process:**
1. Write tests FIRST (define expected behavior)
2. Implement contract to pass tests
3. Refactor for gas optimization and readability
4. Achieve minimum 90% test coverage

**Tools:** Foundry (preferred), Hardhat

### 2. Security-First Approach

**Automated Security Pipeline:**
1. Slither static analysis (on every contract change)
2. Mythril symbolic execution (before deployment)
3. Manual code review (for critical functions)
4. External audit coordination (for production)

**All findings logged in**: `context/SECURITY_LOG.md`

### 3. Documentation-Driven Development

**Requirements:**
- NatSpec comments for all contracts
- Architecture diagrams (Mermaid format)
- Integration guides for frontend developers
- Deployment guides for operations

**Auto-generated docs location**: `docs/generated/`

### 4. Guided Automation (Plan Mode)

**Orchestrator Behavior:**

When receiving complex requests:
1. **Enter Plan Mode** - Break down into steps, identify subagents needed
2. **Ask Clarifying Questions** - Don't assume, verify intentions
3. **Present Plan** - Show estimated token usage, timeline, risks
4. **Wait for Approval** - User must approve before execution
5. **Execute with Updates** - Provide summary updates, not verbose logs
6. **Handle Blockers** - Ask user when uncertain, don't guess

**Example:**
```
User: "Add staking functionality"

Orchestrator Response:
📋 PLAN: Staking Feature Implementation

Questions:
1. Which reward model? (Fixed APY / Variable / Governance-determined)
2. Lock periods? (Flexible / Fixed duration)
3. Which chain first? (Ethereum / BSC / Multiple)

Steps after clarification:
1. Design staking contract architecture
2. Write comprehensive tests (TDD)
3. Implement staking logic
4. Security audit (Slither + Mythril)
5. Deploy to testnet
6. Update frontend (if exists)

Estimated: 60k tokens, 2-3 hours active work

Approve to proceed? ✋
```

### 5. Batch Commits

**Git Strategy:**
- Work happens across multiple subagent tasks
- Commits occur at **workflow completion** (not per-task)
- Commit messages summarize entire workflow
- Context files are updated continuously but committed together

---

## 💰 Token Budget Management

**Budget Status**: `BUDGET_CONSCIOUS` mode active

### Optimization Strategies

1. **Skills over MCPs** (60% token savings)
   - Load domain knowledge via lightweight Skills
   - Use MCPs only for tool execution (Slither, Mythril)

2. **Progressive Context Loading** (40% savings)
   - Load only needed Skills per task
   - Subagents read only relevant context files

3. **Summary Returns** (50% savings)
   - Subagents return concise summaries
   - Implementation details stay in subagent context

4. **Context Caching**
   - This file (CLAUDE.md) cached across sessions
   - Frequently used Skills cached automatically

**Token Usage Monitoring**: Track usage in `context/PROJECT_STATE.md`

---

## 🚀 Quick Start Workflows

### Initialize New Project

**When user says**: "Start a new [DeFi/NFT/DAO] project"

**Orchestrator Actions:**
1. Ask clarifying questions (chain, features, timeline)
2. Update PROJECT_STATE.md with project overview
3. Create ARCHITECTURE.md with initial design
4. Initialize appropriate framework (Hardhat/Anchor)
5. Set up TDD infrastructure
6. Return setup summary

### Develop Smart Contract

**When user says**: "Create a contract for [functionality]"

**Orchestrator Actions:**
1. Confirm requirements (enter Plan Mode if complex)
2. Delegate to `contract-developer` subagent
3. Monitor: TDD compliance, security scan, documentation
4. Review summary from subagent
5. Update PROJECT_STATE.md
6. Batch commit when workflow complete

### Security Audit

**When user says**: "Audit [contract]" or detects "vulnerability" keyword

**Orchestrator Actions:**
1. Delegate to `security-auditor` subagent
2. Run: Slither + Mythril (via MCP)
3. Manual review of findings
4. Update SECURITY_LOG.md with results
5. Block deployment if critical issues found
6. Return audit summary

### Multi-Chain Deployment

**When user says**: "Deploy to [network]"

**Orchestrator Actions:**
1. Verify security audit passed
2. Confirm deployment parameters (semi-automated)
3. Delegate to `deployment-manager` subagent
4. Update DEPLOYMENT_STATE.md with addresses
5. Verify deployment (call contract, check block explorer)
6. Return deployment summary

---

## 📚 Learning Resources

### For Solo Developers

This framework is optimized for **solo full-stack blockchain developers** who need to:
- Build entire dApps (contracts + frontend + deployment)
- Maintain context across weeks/months
- Optimize token usage (budget-conscious)
- Enforce best practices (TDD, security, documentation)

### Key Advantages

✅ **Never lose context** - Documentation-driven persistence
✅ **Token efficient** - 60-70% reduction vs traditional approaches
✅ **Multi-chain ready** - Deploy to Ethereum, Solana, BSC, Avalanche
✅ **Security built-in** - Automated scans with free tools
✅ **Solo-friendly** - One developer can manage full stack

---

## 🎛️ Framework Controls

### Current Settings

```yaml
mode: guided_automation
security_level: standard_plus_tools
tdd_enforcement: strict
documentation: comprehensive
git_commits: batch_at_workflow_completion
token_budget: conservative
multi_chain: enabled
plan_mode: active
```

### Modify Settings

To change framework behavior, update the settings above and notify the orchestrator.

---

## 🆘 Troubleshooting

### Context Lost Between Sessions?

**Check:**
1. Did subagent update context files? (Look in `context/`)
2. Is PROJECT_STATE.md current?
3. Are there uncommitted changes?

**Fix:** Update missing context files manually or re-run subagent with documentation update requirement.

### Token Budget Exceeded?

**Optimize:**
1. Review which Skills are loading (check logs)
2. Consider splitting large tasks into smaller subagent tasks
3. Use more specific task descriptions (reduces unnecessary skill loading)

### Deployment Failed?

**Check:**
1. SECURITY_LOG.md - Are there unresolved critical issues?
2. TESTING_STATUS.md - Is coverage below 90%?
3. Network configuration correct? (RPC URLs, private keys)

---

## 📖 Next Steps

**First Time Using This Framework?**

1. Read: `workflows/develop-contract-tdd.md` - Complete workflow example
2. Review: `skills/blockchain-core/evm-expert/skill.md` - Skill structure example
3. Check: `agents/contract-developer.json` - Subagent configuration example
4. Start: Initialize your first project by describing what you want to build

**Questions?** Ask the orchestrator - it's designed to guide you through the framework.

---

## 🔄 Version

**Framework Version**: 1.0.0-alpha
**Last Updated**: 2025-11-12
**Status**: Foundation Phase (Option C Implementation)

---

*This framework represents the synthesis of BMAD-METHOD, SuperClaude, and Claude Skills best practices, optimized for blockchain/Web3 solo development.*
