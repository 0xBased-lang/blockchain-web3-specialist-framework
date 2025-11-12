# Architecture Decision Records (ADRs)

> **Purpose**: Document significant architectural and technical decisions with rationale and trade-offs.
> **Updated by**: Orchestrator, any agent making significant design decisions
> **Read by**: All agents before making architectural changes

---

## About ADRs

**What are ADRs?**
Architecture Decision Records document important decisions made during development. They capture:
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Trade-offs and implications
- **Alternatives**: What else was considered

**When to create an ADR:**
- Choosing technology stack
- Selecting design patterns
- Making security trade-offs
- Deciding on scalability approaches
- Resolving architectural conflicts

**Format**: See ADR-000 below for template

---

## Decision Log

### ADR-000: Framework Selection (TEMPLATE)

**Date**: 2025-11-12
**Status**: ✅ Accepted
**Deciders**: User + Claude Orchestrator
**Impact**: Critical - Affects entire development workflow

#### Context

Solo blockchain developer needs to manage complex full-stack dApp projects across multiple chains (Ethereum, Solana, BSC, Avalanche) while:
- Maintaining context across days/weeks between work sessions
- Optimizing token usage (budget-conscious)
- Enforcing best practices (TDD, security, documentation)
- Building contracts + frontend + deployment infrastructure alone

Traditional approaches lose context and waste tokens on redundant information.

#### Decision

Adopt **BlockchainOrchestra Framework** with:
- **Documentation-Driven Context Persistence (DDCP)** - Context saved in markdown files
- **Claude Skills** for knowledge (token-efficient progressive loading)
- **Subagents** for isolated task execution
- **Selective MCP usage** (only for tools, not knowledge)
- **Guided automation** (plan mode with user approval)

#### Consequences

**Positive**:
- ✅ Context never lost between sessions (persistent documentation)
- ✅ 60-70% token savings (Skills vs MCPs, isolated contexts)
- ✅ TDD and security enforced automatically
- ✅ Multi-chain support built-in
- ✅ Solo developer can manage full stack

**Negative**:
- ⚠️ Requires discipline to update documentation
- ⚠️ Initial setup overhead (creating skills and agents)
- ⚠️ Learning curve for framework patterns

**Risks**:
- Framework complexity could slow initial development
  - Mitigation: Start with Option C (foundation + one workflow)
- Documentation could become stale if not updated
  - Mitigation: Agent enforcement - subagents MUST update docs

#### Alternatives Considered

**Alternative 1**: Traditional Claude Code without framework
- ❌ Loses context between sessions
- ❌ Higher token usage
- ❌ No enforcement of best practices
- ❌ Rejected

**Alternative 2**: BMAD-METHOD full implementation
- ✅ Excellent federated knowledge architecture
- ⚠️ More complex than needed for solo dev
- ⚠️ Designed for teams, not solo developers
- 📋 Borrowed concepts: Agent-as-code, federated knowledge

**Alternative 3**: SuperClaude Framework
- ✅ Great auto-activation patterns
- ⚠️ TypeScript plugin complexity
- ⚠️ Less blockchain-specific
- 📋 Borrowed concepts: Auto-activation, persona chaining

#### References
- Research: BMAD-METHOD, SuperClaude, Claude Skills best practices
- Decision basis: User requirements (Q1-Q10 responses)

---

### ADR-001: TDD Enforcement Strategy

**Date**: 2025-11-12
**Status**: ✅ Accepted
**Deciders**: User (explicit requirement)
**Impact**: High - Affects all contract development

#### Context

Smart contracts are immutable after deployment. Bugs in production are catastrophic and costly. Need to ensure high code quality and prevent regressions.

User explicitly requested: "Test-driven development (Option A)" with "comprehensive documentation."

#### Decision

**ENFORCE** Test-Driven Development (TDD) for all smart contract code:
- Tests MUST be written before implementation
- contract-developer subagent will BLOCK code writing without tests
- Minimum 90% coverage required for deployment
- Red-Green-Refactor cycle mandatory

#### Consequences

**Positive**:
- ✅ Higher code quality (tests define expected behavior)
- ✅ Fewer bugs in production
- ✅ Easier refactoring (tests catch regressions)
- ✅ Better documentation (tests show usage examples)
- ✅ Confidence in deployments

**Negative**:
- ⚠️ Slower initial development (write tests first)
- ⚠️ More verbose codebase (2:1 test-to-code ratio)

**Risks**:
- Developer frustration if enforcement too strict
  - Mitigation: Clear error messages, helpful guidance
- False security (passing tests ≠ bug-free)
  - Mitigation: Combine with security scans and audits

#### Alternatives Considered

**Alternative 1**: Optional testing (recommendations only)
- ❌ Easy to skip under time pressure
- ❌ Rejected

**Alternative 2**: Post-implementation testing
- ❌ Tests become validation, not specification
- ❌ Harder to achieve high coverage
- ❌ Rejected

#### Implementation

- contract-developer subagent checks for test files before allowing implementation
- TESTING_STATUS.md tracks TDD compliance
- Coverage reports generated automatically
- Deployment blocked if coverage <90%

---

### ADR-002: Multi-Chain Architecture Strategy

**Date**: 2025-11-12
**Status**: ✅ Accepted
**Deciders**: User (required chains: Ethereum, Solana, BSC, Avalanche)
**Impact**: Critical - Affects framework structure

#### Context

Project needs to support multiple blockchain platforms:
- **EVM-compatible**: Ethereum, BSC, Avalanche (same language: Solidity)
- **Non-EVM**: Solana (different language: Rust, different paradigm)

Need strategy to maximize code reuse while respecting platform differences.

#### Decision

**Chain Abstraction via Skills**:

1. **EVM Chains** (Ethereum, BSC, Avalanche)
   - Share `evm-expert` skill
   - Share Solidity contract code (minimal modifications)
   - Use Hardhat framework
   - Deploy same contracts to all three with config changes

2. **Solana**
   - Separate `solana-expert` skill
   - Separate Rust implementation
   - Use Anchor framework
   - Independent deployment pipeline

3. **Deployment State Tracking**
   - DEPLOYMENT_STATE.md tracks all chains
   - deployment-manager handles multi-chain orchestration

#### Consequences

**Positive**:
- ✅ Code reuse across EVM chains (3 for price of 1)
- ✅ Platform-appropriate patterns (no compromises)
- ✅ Clear separation (EVM vs non-EVM)
- ✅ Easy to add new EVM chains (just config)

**Negative**:
- ⚠️ Solana requires parallel development effort
- ⚠️ Different testing strategies per platform
- ⚠️ More complex deployment orchestration

**Risks**:
- EVM chains might have subtle differences
  - Mitigation: Test on each chain's testnet
  - Mitigation: Document chain-specific quirks
- Maintaining feature parity across platforms difficult
  - Mitigation: Prioritize one platform, port features gradually

#### Alternatives Considered

**Alternative 1**: Single chain focus (Ethereum only)
- ✅ Simpler development
- ❌ Misses market opportunities on other chains
- ❌ Rejected (user requires multi-chain)

**Alternative 2**: Abstract VM layer (write once, compile to all)
- ❌ Doesn't exist for Solana
- ❌ Performance compromises
- ❌ Rejected

**Alternative 3**: Separate repositories per chain
- ❌ Context fragmentation
- ❌ Harder to maintain consistency
- ❌ Rejected

#### References
- EVM Compatibility: Ethereum, BSC, Avalanche all support same opcodes
- Solana: Different account model, requires Rust

---

### ADR-003: Security Tooling Strategy

**Date**: 2025-11-12
**Status**: ✅ Accepted
**Deciders**: User (budget-conscious, free tools only)
**Impact**: High - Affects security posture

#### Context

Smart contract security is critical, but professional audits cost $10k-$100k+. User specified:
- "Security Level: Standard + tools"
- "Free tools only (Slither, etc.)"
- "No external audit coordination"

Need to maximize security within free tool constraints.

#### Decision

**Multi-Layer Free Tool Strategy**:

1. **Static Analysis**: Slither (93 detectors)
   - Run on every contract change
   - Block deployment on HIGH/CRITICAL findings

2. **Symbolic Execution**: Mythril
   - Run before deployment
   - Deeper analysis than static

3. **Fuzzing**: Echidna (when needed)
   - Property-based testing for critical logic
   - Invariant checking

4. **Manual Review**: security-auditor subagent
   - Code review checklist
   - Focus on critical functions
   - Document findings in SECURITY_LOG.md

5. **Integration**: Custom MCP
   - `blockchain-tools-mcp` wraps CLI tools
   - Automated execution + parsing

#### Consequences

**Positive**:
- ✅ Zero cost security scanning
- ✅ Automated integration in workflow
- ✅ Catches 80%+ of common vulnerabilities
- ✅ Continuous security (not one-time audit)

**Negative**:
- ⚠️ Free tools miss ~20% of issues (vs professional audit)
- ⚠️ No insurance coverage (audits often include coverage)
- ⚠️ No external validation (professional reputation)

**Risks**:
- False confidence (passing scans ≠ secure)
  - Mitigation: Always assume undiscovered issues exist
  - Mitigation: Start with small deployments, scale carefully
  - Mitigation: Consider external audit for high-value contracts later

#### Alternatives Considered

**Alternative 1**: Professional audit firms (ConsenSys, Trail of Bits)
- ✅ Higher confidence
- ❌ Cost prohibitive ($50k+ typical)
- ❌ Rejected per user constraints

**Alternative 2**: Paid tools (MythX Pro, Certora)
- ✅ Better coverage than free tools
- ❌ Monthly subscription costs
- ❌ Rejected (user wants free only)

**Alternative 3**: Community audit (Code4rena, Sherlock)
- ✅ Lower cost than firms ($5k-$20k)
- ⚠️ Variable quality
- 📋 Future consideration for production deployments

#### Implementation

- security-auditor subagent runs Slither + Mythril
- blockchain-tools-mcp provides tool integration
- SECURITY_LOG.md tracks all findings
- Pre-deployment checklist enforces scans

---

### ADR-004: Git Commit Strategy

**Date**: 2025-11-12
**Status**: ✅ Accepted
**Deciders**: User (explicit preference)
**Impact**: Medium - Affects development workflow

#### Context

When using subagents, multiple files change across isolated contexts. Need strategy for git commits that:
- Preserves logical change grouping
- Doesn't create commit noise
- Works with subagent workflow

User specified: "Batch commits at workflow completion"

#### Decision

**Batch Commits at Workflow Completion**:

1. Subagents work without committing
2. Orchestrator triggers commit when entire workflow completes
3. Commit message summarizes full workflow
4. All related changes in one commit

Example:
```
git add .
git commit -m "Add staking feature with rewards

- Implemented StakingRewards.sol contract
- Added comprehensive unit tests (95% coverage)
- Security scan passed (Slither + Mythril)
- Frontend StakeForm component
- Updated documentation

Closes #123"
```

#### Consequences

**Positive**:
- ✅ Logical commit history (one commit = one feature)
- ✅ Easier to revert if needed
- ✅ Better commit messages (full context)
- ✅ Cleaner git log

**Negative**:
- ⚠️ Larger commits (harder to review)
- ⚠️ Risk of losing work if crash before commit
- ⚠️ Can't bisect within workflow

**Risks**:
- Loss of work if system crashes mid-workflow
  - Mitigation: Context files already updated (work preserved in docs)
  - Mitigation: Can manually commit incomplete work if needed

#### Alternatives Considered

**Alternative 1**: Commit per subagent task
- ❌ Noisy commit history
- ❌ Many small commits
- ❌ Rejected

**Alternative 2**: Commit per file change
- ❌ Extremely noisy
- ❌ Rejected

**Alternative 3**: Manual commits only
- ✅ Maximum control
- ⚠️ Easy to forget
- 📋 User retains manual override

---

### ADR-005: Token Budget Optimization Strategy

**Date**: 2025-11-12
**Status**: ✅ Accepted
**Deciders**: User (budget-conscious mode)
**Impact**: High - Affects cost and performance

#### Context

User specified:
- "Token budget: Budget-conscious"
- "Skills vs MCPs: Optimize for Skills"
- "Response time: Batch-friendly (minutes acceptable)"

Need to minimize token usage while maintaining functionality.

#### Decision

**Aggressive Token Optimization**:

1. **Skills over MCPs** (60% savings)
   - Knowledge via Skills (load on-demand)
   - MCPs only for tool execution

2. **Progressive Context Loading** (40% savings)
   - Load only needed Skills per task
   - Subagents read minimal context files

3. **Isolated Subagent Contexts** (50% savings)
   - Subagents work in separate windows
   - Return summaries, not full context

4. **Caching Strategy**
   - CLAUDE.md cached across sessions
   - Frequently used Skills cached
   - Context files cached

5. **Summary Communication**
   - Subagents: Concise summaries to orchestrator
   - Orchestrator: Summary updates to user

#### Consequences

**Positive**:
- ✅ 60-70% token reduction vs traditional approach
- ✅ Lower operational costs
- ✅ Can afford longer sessions
- ✅ More tokens available for actual work

**Negative**:
- ⚠️ Slightly slower (loading on-demand vs upfront)
- ⚠️ Less verbose output (summaries vs details)

**Risks**:
- Over-optimization might hide useful information
  - Mitigation: Context files preserve all details
  - Mitigation: User can request verbose mode if needed

#### Alternatives Considered

**Alternative 1**: Load everything upfront
- ❌ High token usage
- ❌ Rejected

**Alternative 2**: Moderate optimization
- ⚠️ Doesn't maximize savings
- ❌ Rejected (user wants budget-conscious)

#### Measurement

Track token usage in PROJECT_STATE.md to verify savings.

---

## Template for Future ADRs

```markdown
### ADR-XXX: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-YYY
**Deciders**: [Who made or should make this decision]
**Impact**: Critical | High | Medium | Low - [Brief impact description]

#### Context

[Describe the problem or situation requiring a decision. Include relevant constraints, requirements, and background.]

#### Decision

[Clearly state what was decided. Be specific and unambiguous.]

#### Consequences

**Positive**:
- ✅ [Benefit 1]
- ✅ [Benefit 2]

**Negative**:
- ⚠️ [Trade-off 1]
- ⚠️ [Trade-off 2]

**Risks**:
- [Risk 1]
  - Mitigation: [How to address]

#### Alternatives Considered

**Alternative 1**: [Description]
- ✅ Pros
- ❌ Cons
- ❌ Rejected because [reason]

**Alternative 2**: [Description]
- [Analysis]
- 📋 Future consideration if [condition]

#### References

- [Link to research]
- [Related ADRs]
- [External documentation]

#### Implementation Notes

[Optional: How this decision will be implemented]

---
```

---

## Decision Status Legend

- ✅ **Accepted** - Decision is active and should be followed
- 📋 **Proposed** - Under consideration, not yet decided
- ⚠️ **Deprecated** - No longer recommended, but not forbidden
- ❌ **Superseded** - Replaced by newer decision (see reference)

---

## Instructions for Agents

**When to create an ADR:**

If your decision affects:
- Technology choices (frameworks, libraries)
- Architectural patterns
- Security trade-offs
- Scalability approaches
- Development workflows
- Multi-chain strategies

Then create an ADR documenting it.

**How to create an ADR:**

1. ✅ Copy template above
2. ✅ Assign next ADR number (ADR-006, etc.)
3. ✅ Fill all sections thoughtfully
4. ✅ Consider alternatives seriously
5. ✅ Document trade-offs honestly
6. ✅ Update PROJECT_STATE.md with reference
7. ✅ Notify orchestrator of new ADR

**When to update an ADR:**

- Decision status changes (Accepted → Deprecated)
- New consequences discovered
- Decision is superseded by newer ADR

---

**Last Updated**: 2025-11-12
**Updated By**: System (template + initial ADRs)
**Total ADRs**: 5
