# Smart Contract Audit Methodology Skill

```yaml
---
name: audit-methodology
description: Comprehensive security audit methodology for smart contracts including automated tools (Slither, Mythril, Echidna) and manual review checklists
triggers:
  keywords: [audit, security review, vulnerability, security scan, slither, mythril]
dependencies: []
version: 1.0.0
priority: high
token_budget: 500
---
```

## Audit Process Overview

**4-Phase Audit Methodology**:
1. **Automated Static Analysis** - Slither, Mythril
2. **Property-Based Fuzzing** - Echidna
3. **Manual Code Review** - Security checklist
4. **Remediation & Verification** - Fix issues, re-scan

---

## Phase 1: Automated Static Analysis

### Slither

**Install**: `pip3 install slither-analyzer`

**Basic Scan**:
```bash
slither contracts/MyContract.sol
```

**Advanced Usage**:
```bash
# Exclude low severity
slither contracts/ --exclude-low

# Specific detectors
slither contracts/ --detect reentrancy-eth,unprotected-upgrade

# JSON output
slither contracts/ --json slither-report.json

# Filter paths
slither contracts/ --filter-paths "node_modules,test"
```

**93 Built-in Detectors** (Key ones):
- `reentrancy-eth` - Reentrancy vulnerabilities
- `unprotected-upgrade` - Missing access control on upgrades
- `suicidal` - Unprotected selfdestruct
- `arbitrary-send-eth` - Unprotected ETH transfers
- `controlled-delegatecall` - Delegatecall to user-supplied address
- `tx-origin` - Dangerous use of tx.origin

**Interpreting Results**:
- **HIGH/CRITICAL**: Must fix before deployment
- **MEDIUM**: Should fix, impacts security
- **LOW**: Consider fixing, minor issues
- **INFORMATIONAL**: Code quality, not security

---

### Mythril

**Install**: `pip3 install mythril`

**Basic Scan**:
```bash
myth analyze contracts/MyContract.sol
```

**Advanced**:
```bash
# Set execution timeout
myth analyze contracts/MyContract.sol --execution-timeout 300

# Specific Solidity version
myth analyze contracts/MyContract.sol --solv 0.8.20

# Max depth
myth analyze contracts/MyContract.sol --max-depth 128

# JSON output
myth analyze contracts/MyContract.sol -o json > mythril-report.json
```

**What Mythril Finds**:
- Integer overflows (pre-0.8.0)
- Reentrancy
- Unprotected selfdestruct
- Delegatecall to untrusted contract
- State access after external call

**Typical Scan Time**: 2-5 minutes per contract

---

## Phase 2: Property-Based Fuzzing

### Echidna

**Install**: `docker pull trailofbits/eth-security-toolbox`

**Setup Invariant Tests**:
```solidity
// test/echidna/StakingInvariants.sol
pragma solidity ^0.8.20;

import "../../contracts/Staking.sol";

contract StakingInvariants is Staking {
    constructor() Staking(...) {}

    // Invariant: total staked never exceeds token supply
    function echidna_total_not_exceeds_supply() public view returns (bool) {
        return totalStaked <= token.totalSupply();
    }

    // Invariant: user balance never negative
    function echidna_balance_never_negative() public view returns (bool) {
        return stakes[msg.sender] >= 0;
    }

    // Invariant: contract balance matches accounting
    function echidna_accounting_correct() public view returns (bool) {
        uint256 accountedBalance = 0;
        // Sum all user stakes...
        return address(this).balance >= accountedBalance;
    }
}
```

**Run Echidna**:
```bash
echidna-test contracts/test/echidna/StakingInvariants.sol --contract StakingInvariants --test-mode assertion
```

**Configuration** (`echidna.yaml`):
```yaml
testLimit: 10000       # Number of transactions
seqLen: 100            # Transactions per campaign
shrinkLimit: 5000      # Simplification attempts
deployer: "0x..."      # Deployer address
sender: ["0x...", "0x..."]  # Test accounts
```

---

## Phase 3: Manual Code Review

### Security Checklist

**Access Control**:
- [ ] All admin functions have `onlyOwner` or similar
- [ ] Role-based access uses OpenZeppelin `AccessControl`
- [ ] No use of `tx.origin` for authorization
- [ ] Multi-sig for critical operations

**Reentrancy**:
- [ ] All external calls use `ReentrancyGuard`
- [ ] Checks-Effects-Interactions pattern followed
- [ ] State updated before external calls
- [ ] View functions don't make external calls

**Arithmetic**:
- [ ] Solidity 0.8+ used (automatic overflow protection)
- [ ] Or SafeMath used for <0.8
- [ ] Division by zero checked
- [ ] Rounding handled correctly

**Token Handling**:
- [ ] Using `SafeERC20` for token transfers
- [ ] Approve/transferFrom race condition handled
- [ ] Token balance checked after transfer
- [ ] No assumption of ERC20 standard compliance

**External Calls**:
- [ ] Return values checked (low-level calls)
- [ ] Gas limits considered for loops
- [ ] Delegatecall only to trusted contracts
- [ ] No selfdestruct without access control

**Upgradeability** (if applicable):
- [ ] Storage layout compatible
- [ ] Initializer protected (`initializer` modifier)
- [ ] No constructor (use `initialize`)
- [ ] Upgrade authority secured

**Oracle/Price Feeds**:
- [ ] Using Chainlink or TWAP
- [ ] Staleness checks implemented
- [ ] Price manipulation resistant
- [ ] Fallback oracle available

**Front-Running**:
- [ ] Commit-reveal if sensitive
- [ ] Slippage protection on DEX trades
- [ ] Transaction ordering doesn't matter
- [ ] MEV considerations addressed

**Gas Optimization**:
- [ ] No unbounded loops
- [ ] Storage reads minimized
- [ ] Events used for data not needed on-chain
- [ ] Packing storage variables

**Testing**:
- [ ] >90% code coverage
- [ ] Edge cases tested
- [ ] Failure scenarios tested
- [ ] Integration tests exist

---

## Phase 4: Remediation

### Priority System

**CRITICAL** (Fix immediately):
- Reentrancy allowing fund theft
- Access control bypass
- Integer overflow in fund calculations
- Unprotected selfdestruct

**HIGH** (Fix before deployment):
- Reentrancy without immediate fund risk
- Oracle manipulation
- Front-running vulnerabilities
- DoS attacks

**MEDIUM** (Fix recommended):
- Gas optimization issues causing DoS
- Centralization risks
- Poor error handling
- Missing events

**LOW** (Consider fixing):
- Code style inconsistencies
- Unused variables
- Minor gas optimizations
- Documentation gaps

**INFORMATIONAL** (Optional):
- Suggestions for improvement
- Alternative patterns
- Best practice recommendations

---

## Audit Report Template

```markdown
# Security Audit Report: [Contract Name]

**Date**: 2025-11-12
**Auditor**: security-auditor
**Commit**: abc123...

## Executive Summary

- **Critical Issues**: 0
- **High Severity**: 1
- **Medium Severity**: 3
- **Low Severity**: 5
- **Informational**: 10

## Scope

Contracts audited:
- contracts/Staking.sol
- contracts/Rewards.sol

## Methodology

1. Automated analysis (Slither, Mythril)
2. Manual code review
3. Property-based fuzzing (Echidna)

## Findings

### [CRITICAL-001] Reentrancy in withdraw()

**Severity**: CRITICAL
**Status**: FIXED

**Description**:
The `withdraw()` function updates state after external call, allowing reentrancy attack.

**Location**: `Staking.sol:123-130`

**Recommendation**:
Add `ReentrancyGuard` and follow checks-effects-interactions pattern.

**Fix Verification**:
✅ ReentrancyGuard added
✅ State updated before external call
✅ Re-tested with Slither - passed

---

### [HIGH-001] Missing access control on setRewardRate()

**Severity**: HIGH
**Status**: PENDING

**Description**:
Anyone can call `setRewardRate()` to modify rewards.

**Recommendation**:
Add `onlyOwner` modifier.

---

## Tools Used

- Slither v0.10.0
- Mythril v0.24.0
- Echidna v2.2.0
- Manual review

## Conclusion

After remediation of critical and high severity issues, contract is **APPROVED FOR TESTNET**.

Mainnet deployment pending:
- [ ] Fix HIGH-001
- [ ] Fix MEDIUM issues
- [ ] External audit (recommended)
```

---

## Continuous Monitoring

**Post-Deployment**:
- Monitor contract events for suspicious activity
- Set up alerts for large transactions
- Track admin function calls
- Watch for unusual patterns

**Tools**:
- OpenZeppelin Defender (Sentinel)
- Tenderly
- Custom event listeners

---

## Activation

Loads when keywords: audit, security review, vulnerability, slither, mythril

**Token Budget**: ~500 tokens

---

**Version**: 1.0.0
**Last Updated**: 2025-11-12
