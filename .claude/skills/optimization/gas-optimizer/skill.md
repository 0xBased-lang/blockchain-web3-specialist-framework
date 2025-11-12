# Gas Optimization Skill

```yaml
---
name: gas-optimizer
description: Advanced gas optimization techniques for EVM smart contracts including storage packing, compute optimization, and gas profiling
triggers:
  keywords: [gas optimization, gas efficient, optimize gas, gas cost, storage packing]
dependencies: ["evm-expert"]
version: 1.0.0
priority: medium
token_budget: 500
---
```

## Storage Optimization

### 1. Variable Packing

**Slots**: Each storage slot = 32 bytes.

```solidity
// ❌ BAD: 3 storage slots (96 bytes)
struct UserBad {
    uint128 balance;    // Slot 0 (wastes 16 bytes)
    address owner;      // Slot 1 (20 bytes, wastes 12 bytes)
    uint64 timestamp;   // Slot 2 (wastes 24 bytes)
}

// ✅ GOOD: 2 storage slots (64 bytes)
struct UserGood {
    uint128 balance;    // Slot 0 (16 bytes)
    uint64 timestamp;   // Slot 0 (8 bytes) - packed!
    uint64 unused;      // Slot 0 (8 bytes) - fills slot
    address owner;      // Slot 1 (20 bytes)
}
```

**Savings**: 1 slot = ~20,000 gas on write, ~2,100 gas on read.

---

### 2. Use Smaller Types

```solidity
// ❌ uint256 when smaller works
uint256 public count;  // 0-100 range

// ✅ uint8 saves storage
uint8 public count;    // Fits in 1 byte

// ⚠️ Warning: Arithmetic with uint8 still uses uint256 in EVM
// Only saves storage, not computation
```

---

### 3. Bit Packing (Flags)

```solidity
// ❌ Multiple bool storage variables (32 bytes each!)
bool public isActive;
bool public isVerified;
bool public isPremium;

// ✅ Single uint8 with bit flags (1 byte)
uint8 public flags;

uint8 constant FLAG_ACTIVE = 1;     // 0001
uint8 constant FLAG_VERIFIED = 2;   // 0010
uint8 constant FLAG_PREMIUM = 4;    // 0100

function setActive(bool value) external {
    if (value) {
        flags |= FLAG_ACTIVE;   // Set bit
    } else {
        flags &= ~FLAG_ACTIVE;  // Clear bit
    }
}

function isActive() public view returns (bool) {
    return (flags & FLAG_ACTIVE) != 0;
}
```

**Savings**: ~17,000 gas per bool converted to bit flag.

---

## Memory Optimization

### 1. Use `calldata` for Read-Only Arrays

```solidity
// ❌ Copies array to memory (~1000 gas/element)
function process(uint256[] memory data) external {
    // Read data...
}

// ✅ Reads directly from calldata
function process(uint256[] calldata data) external {
    // Much cheaper!
}
```

---

### 2. Cache Storage Reads

```solidity
// ❌ Multiple storage reads (2,100 gas each)
function bad() external {
    require(balance[msg.sender] > 0);
    balance[msg.sender] -= 100;
    emit Withdrawn(balance[msg.sender]);  // 3rd read!
}

// ✅ Single storage read, cached in memory
function good() external {
    uint256 currentBalance = balance[msg.sender];  // Read once
    require(currentBalance > 0);
    currentBalance -= 100;
    balance[msg.sender] = currentBalance;          // Write once
    emit Withdrawn(currentBalance);
}
```

---

## Loop Optimization

### 1. Cache Array Length

```solidity
// ❌ Reads length every iteration
function bad(uint256[] memory arr) external {
    for (uint256 i = 0; i < arr.length; i++) {
        // process...
    }
}

// ✅ Cache length
function good(uint256[] memory arr) external {
    uint256 length = arr.length;  // Read once
    for (uint256 i = 0; i < length; i++) {
        // process...
    }
}
```

---

### 2. Use `++i` Instead of `i++`

```solidity
// ❌ i++ costs ~5 gas more
for (uint256 i = 0; i < length; i++) {}

// ✅ ++i is cheaper
for (uint256 i = 0; i < length; ++i) {}

// ✅ BEST: unchecked increment (saves ~25 gas)
for (uint256 i = 0; i < length;) {
    // process...

    unchecked { ++i; }  // i can't realistically overflow
}
```

---

## Custom Errors

```solidity
// ❌ String errors (~4,000 gas)
require(balance >= amount, "Insufficient balance");

// ✅ Custom errors (~200 gas)
error InsufficientBalance(uint256 available, uint256 required);

if (balance < amount) {
    revert InsufficientBalance(balance, amount);
}
```

**Savings**: ~3,800 gas per error.

---

## Short-Circuit Evaluation

```solidity
// ✅ Put cheap checks first
require(amount > 0 && balance[msg.sender] >= amount);
//      ^ cheap    ^ expensive (storage read)

// If amount == 0, doesn't read storage!
```

---

## Immutable & Constant

```solidity
// ❌ Storage variable (2,100 gas per read)
address public owner;

// ✅ Immutable (set in constructor, inlined in bytecode)
address public immutable owner;

// ✅ Constant (known at compile time)
uint256 public constant MAX_SUPPLY = 10000;
```

---

## Function Visibility

```solidity
// ✅ External cheaper than public (if not called internally)
function externalFunc() external {}  // Cheaper

function publicFunc() public {}      // More expensive

// Public creates internal and external versions
// External only creates external version
```

---

## Payable Functions

```solidity
// ❌ Non-payable check costs gas
function transfer() external {}

// ✅ Payable skips non-payable check (~24 gas)
function transfer() external payable {}

// Safe if you handle msg.value correctly
```

---

## Packing Function Parameters

```solidity
// ❌ Each parameter padded to 32 bytes
function bad(uint8 a, uint8 b, uint8 c) external {}

// ✅ Pack into single uint256
function good(uint256 packed) external {
    uint8 a = uint8(packed);
    uint8 b = uint8(packed >> 8);
    uint8 c = uint8(packed >> 16);
}

// Off-chain: pack(a, b, c) = a | (b << 8) | (c << 16)
```

---

## Gas Profiling

### Foundry Gas Reports

```bash
forge test --gas-report
```

Output:
```
| Function      | avg     | median  | max     |
|---------------|---------|---------|---------|
| stake         | 125,234 | 124,000 | 150,000 |
| withdraw      | 98,456  | 97,000  | 120,000 |
```

### Foundry Gas Snapshots

```bash
forge snapshot
```

Creates `.gas-snapshot`:
```
StakingTest:testStake() (gas: 125234)
StakingTest:testWithdraw() (gas: 98456)
```

Track gas changes over time!

---

## Optimization Checklist

**Storage**:
- [ ] Variables packed efficiently
- [ ] Using smallest types possible
- [ ] Bit flags for booleans
- [ ] `immutable` and `constant` used
- [ ] Storage reads cached

**Loops**:
- [ ] Array length cached
- [ ] `++i` instead of `i++`
- [ ] Unchecked increment when safe
- [ ] No unbounded loops

**Functions**:
- [ ] `external` instead of `public` when possible
- [ ] `calldata` for read-only arrays
- [ ] Custom errors instead of strings
- [ ] Short-circuit evaluation
- [ ] `payable` when appropriate

**General**:
- [ ] Gas profiling run
- [ ] Hot paths optimized first
- [ ] Readability vs optimization balanced

---

## Advanced: Assembly Optimization

**Use sparingly** - only for hot paths after profiling.

```solidity
// Gas-optimized transfer
function transfer(address to, uint256 amount) external {
    assembly {
        // Load balance
        let slot := sload(balance.slot)

        // Check sufficient balance
        if lt(slot, amount) {
            revert(0, 0)
        }

        // Update balance
        sstore(balance.slot, sub(slot, amount))

        // Call transfer
        let success := call(gas(), to, amount, 0, 0, 0, 0)
        if iszero(success) {
            revert(0, 0)
        }
    }
}
```

**⚠️ Warning**: Assembly is dangerous and hard to audit. Only use when necessary.

---

## Typical Gas Costs (EVM)

| Operation | Gas Cost |
|-----------|----------|
| SSTORE (new) | 20,000 |
| SSTORE (update) | 5,000 |
| SLOAD | 2,100 |
| MLOAD/MSTORE | 3 |
| ADD/SUB | 3 |
| MUL/DIV | 5 |
| SHA3 | 30 + 6/word |
| CALL | 700+ |
| CREATE | 32,000 |

---

## Activation

Loads when: gas optimization, gas efficient, optimize gas, gas cost, storage packing

**Token Budget**: ~500 tokens

---

**Version**: 1.0.0
**Last Updated**: 2025-11-12
