---
name: security-audit
description: Perform comprehensive security audits of smart contracts using static analysis, vulnerability detection, and best practice checks
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
argument-hint: "contract path or address to audit"
model: sonnet
---

# Security Audit Skill

## Activation Triggers

Activate when user:
- Asks to audit a smart contract
- Mentions security analysis or vulnerability scanning
- Provides contract address for inspection
- Uses keywords: "audit", "security", "vulnerabilities", "analyze contract"
- Wants pre-deployment security check

## Capabilities

- Static bytecode analysis
- Known vulnerability detection
- Gas optimization recommendations
- Access control verification
- Reentrancy detection
- Integer overflow/underflow checks
- External call safety analysis
- Best practices compliance

## Audit Workflow

### Phase 1: Contract Analysis

**User**: "Audit this contract: 0x1234...5678"

**Actions**:
```typescript
import { ContractAnalyzer } from './src/subagents/ContractAnalyzer';

const analyzer = new ContractAnalyzer({
  sourcifyEnabled: true,  // Fetch source from Sourcify
  cacheEnabled: true,
  deepAnalysis: true,     // Enable all checks
});

const result = await analyzer.analyzeContract(
  contractAddress,
  'ethereum',
  {
    includeGasAnalysis: true,
    checkExternalCalls: true,
    verifyAccessControl: true,
  }
);
```

### Phase 2: Vulnerability Scanning

**Checks Performed**:

1. **Reentrancy Vulnerabilities**
   - CALL before SSTORE pattern
   - Missing ReentrancyGuard
   - State changes after external calls

2. **Access Control**
   - Missing owner checks
   - Unprotected sensitive functions
   - Proper modifier usage

3. **Integer Arithmetic**
   - Overflow/underflow (pre-0.8.0)
   - SafeMath usage
   - Unchecked blocks

4. **External Calls**
   - DELEGATECALL to untrusted contracts
   - Return value not checked
   - Gas limits on loops

5. **Timestamp Dependence**
   - Block timestamp manipulation
   - Block number as randomness

6. **Gas Optimization**
   - Inefficient storage usage
   - Repeated external calls
   - Large loop iterations

7. **Best Practices**
   - Floating pragma
   - Missing events
   - Proper naming conventions

### Phase 3: Risk Assessment

```typescript
// Risk levels based on findings
const riskLevel = calculateRisk(findings);

const riskLevels = {
  critical: findings.filter(f => f.severity === 'critical').length,
  high: findings.filter(f => f.severity === 'high').length,
  medium: findings.filter(f => f.severity === 'medium').length,
  low: findings.filter(f => f.severity === 'low').length,
};
```

### Phase 4: Report Generation

**Output**:
```
╔═══════════════════════════════════════════════════════════╗
║  Smart Contract Security Audit Report                     ║
╚═══════════════════════════════════════════════════════════╝

Contract: MyToken (0x1234...5678)
Chain: Ethereum Mainnet
Audited: 2025-11-16 14:30:00 UTC
Analyzer: ContractAnalyzer v1.0.0

═══════════════════════════════════════════════════════════
 SUMMARY
═══════════════════════════════════════════════════════════

Overall Risk Level: HIGH ⚠️

Findings:
  🔴 Critical: 1
  🟠 High:     2
  🟡 Medium:   3
  🔵 Low:      5
  ✓  Info:     8

Total: 19 findings

═══════════════════════════════════════════════════════════
 CRITICAL FINDINGS
═══════════════════════════════════════════════════════════

🔴 CRT-001: Reentrancy Vulnerability
Location: withdraw() function (line 45)
Severity: CRITICAL
Impact: Funds can be drained through reentrancy attack

Description:
The withdraw() function makes an external call before updating
the user's balance, allowing attackers to recursively call
withdraw() and drain the contract.

Vulnerable Code:
```solidity
function withdraw() public {
    uint amount = balances[msg.sender];
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    balances[msg.sender] = 0; // ❌ State change AFTER external call
}
```

Recommendation:
Apply checks-effects-interactions pattern:
```solidity
function withdraw() public nonReentrant {
    uint amount = balances[msg.sender];
    balances[msg.sender] = 0; // ✓ State change BEFORE external call
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

References:
- SWC-107: Reentrancy
- Similar to DAO Hack (2016, $60M stolen)

═══════════════════════════════════════════════════════════
 HIGH FINDINGS
═══════════════════════════════════════════════════════════

🟠 HIGH-001: Unprotected DELEGATECALL
Location: proxy() function (line 78)
Severity: HIGH
Impact: Arbitrary code execution, complete contract takeover

Description:
The proxy() function allows DELEGATECALL to any address without
access control, allowing attackers to execute arbitrary code in
the context of the contract.

Vulnerable Code:
```solidity
function proxy(address target, bytes memory data) public {
    target.delegatecall(data); // ❌ No access control
}
```

Recommendation:
```solidity
function proxy(address target, bytes memory data)
    public
    onlyOwner  // ✓ Add access control
    onlyWhitelisted(target) // ✓ Whitelist allowed targets
{
    target.delegatecall(data);
}
```

🟠 HIGH-002: Missing Return Value Check
Location: transfer() calls (lines 123, 156)
Severity: HIGH
Impact: Silent failures, incorrect state assumptions

[... additional findings ...]

═══════════════════════════════════════════════════════════
 RECOMMENDATIONS
═══════════════════════════════════════════════════════════

Immediate Actions Required:
1. ✗ Fix CRT-001 reentrancy vulnerability (URGENT)
2. ✗ Add access control to DELEGATECALL (HIGH)
3. ✗ Check all external call return values (HIGH)

Before Deployment:
4. Add comprehensive test coverage (current: 45%)
5. Implement ReentrancyGuard from OpenZeppelin
6. Add events for all state changes
7. Enable Solidity 0.8+ overflow protection
8. Set up multi-sig for admin functions

Gas Optimizations:
9. Cache storage variables in memory (save ~5,000 gas/tx)
10. Use immutable for constants (save ~2,000 gas/deployment)
11. Pack struct variables (save ~20,000 gas/deployment)

═══════════════════════════════════════════════════════════
 CONTRACT INFORMATION
═══════════════════════════════════════════════════════════

Solidity Version: 0.7.6 (outdated, use 0.8+)
Compiler: solc 0.7.6
Optimizer: Enabled (200 runs)
Contract Size: 22.4 KB (within 24KB limit ✓)
License: MIT

Functions:
  Public/External: 12
  Internal/Private: 8
  Payable: 3 (⚠️ review carefully)

Storage Variables: 15
  Public: 8
  Private: 7

Dependencies:
  ✓ @openzeppelin/contracts 3.4.0
  ⚠️ Consider upgrading to 4.9+ for latest security fixes

═══════════════════════════════════════════════════════════
 RISK MATRIX
═══════════════════════════════════════════════════════════

Attack Vectors:
  Reentrancy:              🔴 Critical
  Access Control:          🟠 High
  Integer Overflow:        🟢 Low (Solidity < 0.8)
  External Calls:          🟠 High
  Timestamp Dependence:    🟡 Medium
  Gas Limitations:         🟢 Low
  DoS Attacks:             🟡 Medium

Deployment Readiness: ❌ NOT READY

Required Fixes: 6 critical/high issues
Recommended Fixes: 8 medium/low issues
Nice to Have: 8 informational improvements

═══════════════════════════════════════════════════════════
 CONCLUSION
═══════════════════════════════════════════════════════════

⚠️ This contract has CRITICAL security vulnerabilities and is
   NOT SAFE for deployment to mainnet.

Required Actions:
1. Fix the reentrancy vulnerability immediately
2. Add proper access controls
3. Upgrade to Solidity 0.8+
4. Increase test coverage to >80%
5. Conduct another audit after fixes

Estimated Time to Fix: 40-60 hours
Recommended: Professional audit before mainnet deployment

═══════════════════════════════════════════════════════════

Generated by: Blockchain Web3 Specialist Framework
Report ID: AUD-20251116-143000
Valid Until: 2025-11-23 (7 days)
```

## Automated Scans

### Integration with External Tools

```bash
# Slither (Static Analyzer)
slither contracts/MyContract.sol \
  --print human-summary \
  --json slither-report.json

# Mythril (Symbolic Execution)
myth analyze contracts/MyContract.sol \
  --execution-timeout 300 \
  --solver-timeout 100000

# Echidna (Fuzzing)
echidna-test contracts/MyContract.sol \
  --config echidna-config.yaml
```

## Implementation

### Required Files

- `src/subagents/ContractAnalyzer.ts` - Main analyzer
- `src/types/contract.ts` - Contract type definitions
- `src/utils/logger.ts` - Logging

### Vulnerability Patterns

```typescript
const VULNERABILITY_PATTERNS = {
  reentrancy: {
    pattern: /CALL.*SSTORE/,
    severity: 'critical',
    description: 'Potential reentrancy vulnerability',
  },
  delegatecall: {
    opcode: '0xf4',
    severity: 'high',
    description: 'Dangerous DELEGATECALL detected',
  },
  selfdestruct: {
    opcode: '0xff',
    severity: 'medium',
    description: 'Contract can be destroyed',
  },
  timestamp: {
    opcode: '0x42', // TIMESTAMP
    severity: 'low',
    description: 'Timestamp dependence detected',
  },
};
```

## Examples

### Example 1: Quick Audit

**User**: "Quick security check for 0x1234...5678"

- Basic bytecode scan
- Known vulnerability check
- 30 second analysis

### Example 2: Deep Audit

**User**: "Full security audit with source code"

- Complete static analysis
- Source code review
- Gas optimization
- Best practices check
- 5-10 minute analysis

### Example 3: Pre-Deployment Audit

**User**: "Audit before deploying contracts/Token.sol"

- Compile contract
- Run all security checks
- Generate detailed report
- Provide fix recommendations

## Related Skills

- Use `contract-deploy` after audit passes
- Use `blockchain-query` to inspect deployed contracts
- Use `wallet-manager` for secure key management during fixes
