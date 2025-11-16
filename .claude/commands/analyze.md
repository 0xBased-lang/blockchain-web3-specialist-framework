---
description: Analyze smart contracts for security vulnerabilities and code quality
---

# Analyze Smart Contract

You are now in contract analysis mode. Perform comprehensive security and quality analysis.

## Task

Analyze the provided smart contract for:
- Security vulnerabilities
- Gas optimization opportunities
- Code quality issues
- Best practice violations
- Deployment readiness

## Analysis Types

### 1. Security Analysis (Primary)

**Checks**:
- Reentrancy vulnerabilities
- Access control issues
- Integer overflow/underflow
- External call safety
- Timestamp dependence
- DELEGATECALL risks
- Unprotected SELFDESTRUCT
- Front-running vulnerabilities
- DoS attack vectors

**Tools**:
- ContractAnalyzer subagent (built-in)
- Slither (if available)
- Mythril (if available)

### 2. Gas Analysis

**Checks**:
- Inefficient storage patterns
- Repeated computations
- Unnecessary external calls
- Loop gas consumption
- Contract size optimization

**Tool**: GasOptimizer subagent

### 3. Code Quality

**Checks**:
- Floating pragma
- Missing events
- Unused variables
- Magic numbers
- Naming conventions
- Comment quality
- Test coverage

### 4. Best Practices

**Checks**:
- OpenZeppelin usage
- ReentrancyGuard implementation
- Proper access control (Ownable, AccessControl)
- SafeMath usage (pre-0.8.0)
- Events for state changes
- Error messages
- NatSpec documentation

## Usage Examples

### Quick Analysis
User: "/analyze 0x1234...5678"
→ Basic security scan of deployed contract

### Deep Analysis
User: "/analyze contracts/MyToken.sol --deep"
→ Full analysis with gas optimization and best practices

### Pre-Deployment Analysis
User: "/analyze contracts/NFT.sol --pre-deploy"
→ Comprehensive check before deployment, STOP if critical issues

## Analysis Workflow

1. **Input Detection**
   - Contract address (deployed)
   - File path (source code)
   - Bytecode (hex string)

2. **Data Gathering**
   - Fetch bytecode from chain (if address)
   - Compile source code (if file path)
   - Fetch verified source (if available)

3. **Run Analysis**
   ```typescript
   const analyzer = new ContractAnalyzer({
     deepAnalysis: true,
     sourcifyEnabled: true,
     cacheEnabled: false, // Fresh analysis
   });

   const result = await analyzer.analyzeContract(
     contractAddress,
     'ethereum',
     { includeGasAnalysis: true }
   );
   ```

4. **Generate Report**
   - Severity-based grouping
   - Code snippets for issues
   - Specific recommendations
   - References to similar exploits
   - Fix examples

5. **Risk Assessment**
   - Overall risk level
   - Deployment readiness
   - Required vs optional fixes
   - Time estimate for fixes

## Output Format

```
╔═══════════════════════════════════════════════╗
║  Smart Contract Analysis Report               ║
╚═══════════════════════════════════════════════╝

Contract: MyToken
Analysis Date: 2025-11-16
Analyzer: v1.0.0

─────────────────────────────────────────────────
SUMMARY
─────────────────────────────────────────────────

Risk Level: HIGH ⚠️

Findings:
  🔴 Critical: 1
  🟠 High:     2
  🟡 Medium:   3
  🔵 Low:      5

Deployment Ready: ❌ NO

─────────────────────────────────────────────────
CRITICAL ISSUES
─────────────────────────────────────────────────

🔴 CRT-001: Reentrancy in withdraw()
Location: line 45
Severity: CRITICAL
Impact: Complete fund drainage possible

[Detailed finding with code and fix]

─────────────────────────────────────────────────
RECOMMENDATIONS
─────────────────────────────────────────────────

Immediate (Required):
1. Fix reentrancy vulnerability
2. Add access controls
3. Check external call returns

Before Deployment:
4. Increase test coverage
5. Add events
6. Enable Solidity 0.8+

Optional:
7. Gas optimizations
8. Code cleanup
```

## Decision Making

Based on findings:

- **Critical issues**: STOP deployment, require fixes
- **High issues**: Warn strongly, require acknowledgment
- **Medium/Low**: Inform, allow proceed with caution
- **No issues**: Green light with best practice suggestions

## Use Skills

Activate the `security-audit` skill for comprehensive analysis.

Provide actionable, specific guidance - not just issue identification.
