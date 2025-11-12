# EVM Smart Contract Expert Skill

```yaml
---
name: evm-expert
description: Expert knowledge in EVM smart contract development including Solidity/Vyper, security patterns, gas optimization, and best practices for Ethereum, BSC, and Avalanche
triggers:
  files:
    - "*.sol"
    - "*.vy"
  keywords:
    - solidity
    - smart contract
    - ethereum
    - evm
    - gas optimization
    - vyper
    - bsc
    - avalanche
dependencies: []
version: 1.0.0
priority: high
token_budget: 800
last_updated: 2025-11-12
---
```

## Core Competencies

This skill provides expert-level knowledge in:

1. **Solidity Development** (0.8.0+)
   - Modern language features and best practices
   - Design patterns and anti-patterns
   - Gas-efficient code structures

2. **Security Vulnerability Detection**
   - Common attack vectors and mitigations
   - OpenZeppelin security patterns
   - Auditing best practices

3. **Gas Optimization**
   - Storage optimization techniques
   - Computational efficiency patterns
   - EVM opcode-level understanding

4. **EVM-Compatible Chains**
   - Ethereum mainnet considerations
   - BSC (Binance Smart Chain) specifics
   - Avalanche C-Chain deployment

---

## Solidity Best Practices (0.8.20+)

### Language Version

**Always use latest stable Solidity**: Currently 0.8.20+

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;  // Use ^0.8.20 or higher
```

**Why**:
- Built-in overflow/underflow protection (no SafeMath needed)
- Latest security features
- Gas optimizations
- Custom errors (cheaper than string reverts)

---

### Contract Structure Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title StakingRewards
 * @author Your Name
 * @notice Manages staking deposits and reward distribution
 * @dev Implements checks-effects-interactions pattern
 */
contract StakingRewards is Ownable, ReentrancyGuard, Pausable {
    // 1. Type declarations
    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 rewardDebt;
    }

    // 2. State variables
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    uint256 public rewardRate;

    // 3. Events
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 reward);

    // 4. Errors (custom errors save gas)
    error InsufficientBalance();
    error ZeroAmount();
    error TransferFailed();

    // 5. Modifiers
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }

    // 6. Constructor
    constructor(uint256 _rewardRate) {
        rewardRate = _rewardRate;
    }

    // 7. External functions
    function stake(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        validAmount(amount)
    {
        // Implementation
    }

    // 8. Public functions
    function calculateReward(address user) public view returns (uint256) {
        // Implementation
    }

    // 9. Internal functions
    function _updateReward(address user) internal {
        // Implementation
    }

    // 10. Private functions
    function _transfer(address to, uint256 amount) private {
        // Implementation
    }
}
```

---

## Security Patterns & Vulnerability Prevention

### 1. Reentrancy Protection

**Vulnerability**: Attacker calls back into contract before state updates.

**BAD** ❌:
```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);

    // ❌ VULNERABLE: External call before state update
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);

    balances[msg.sender] -= amount;  // Too late!
}
```

**GOOD** ✅:
```solidity
function withdraw(uint256 amount) external nonReentrant {
    require(balances[msg.sender] >= amount);

    // ✅ Update state BEFORE external call
    balances[msg.sender] -= amount;

    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
```

**Best Practice**:
- Use OpenZeppelin's `ReentrancyGuard`
- Follow checks-effects-interactions pattern
- Update state before external calls

---

### 2. Integer Overflow/Underflow

**Good News**: Solidity 0.8+ has built-in protection!

```solidity
// Solidity 0.8+: Automatically reverts on overflow
uint256 a = type(uint256).max;
uint256 b = a + 1;  // ✅ Reverts automatically

// For checked math (optional, more explicit):
function safeAdd(uint256 a, uint256 b) public pure returns (uint256) {
    return a + b;  // Reverts on overflow
}

// For unchecked math (use cautiously, saves gas):
function unsafeAdd(uint256 a, uint256 b) public pure returns (uint256) {
    unchecked {
        return a + b;  // No overflow check, cheaper gas
    }
}
```

**When to use `unchecked`**:
- Loop counters (where overflow is impossible)
- Calculations that are mathematically guaranteed safe
- Gas optimization in hot paths

---

### 3. Access Control

**BAD** ❌:
```solidity
address public owner;

function criticalFunction() external {
    require(msg.sender == owner);  // ❌ Manual access control
    // ...
}
```

**GOOD** ✅:
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    function criticalFunction() external onlyOwner {
        // ✅ Use OpenZeppelin's battle-tested access control
    }
}
```

**Advanced Access Control**:
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MyContract is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    function adminFunction() external onlyRole(ADMIN_ROLE) {
        // Only admins
    }

    function operatorFunction() external onlyRole(OPERATOR_ROLE) {
        // Only operators
    }
}
```

---

### 4. Front-Running Protection

**Vulnerability**: Miners/bots see your transaction and front-run it.

**Mitigation Strategies**:

```solidity
// 1. Commit-Reveal Scheme
mapping(bytes32 => uint256) public commits;

function commit(bytes32 hash) external {
    commits[hash] = block.number;
}

function reveal(uint256 value, bytes32 salt) external {
    bytes32 hash = keccak256(abi.encodePacked(msg.sender, value, salt));
    require(commits[hash] > 0, "No commitment");
    require(block.number > commits[hash] + 5, "Too soon");

    // Process value...
}

// 2. Slippage Protection (DEX trades)
function swap(uint256 amountIn, uint256 minAmountOut) external {
    uint256 amountOut = calculateSwap(amountIn);
    require(amountOut >= minAmountOut, "Slippage too high");
    // Execute swap...
}
```

---

### 5. Oracle Manipulation

**BAD** ❌:
```solidity
// ❌ Using spot price from DEX (manipulable in single transaction)
function getPrice() public view returns (uint256) {
    return uniswapPair.getReserves();  // Flashloan attack vector!
}
```

**GOOD** ✅:
```solidity
// ✅ Use Chainlink price feeds
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PriceConsumer {
    AggregatorV3Interface internal priceFeed;

    constructor() {
        // ETH/USD on Ethereum mainnet
        priceFeed = AggregatorV3Interface(
            0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
        );
    }

    function getLatestPrice() public view returns (int) {
        (
            ,
            int price,
            ,
            uint timeStamp,

        ) = priceFeed.latestRoundData();

        require(timeStamp > block.timestamp - 3600, "Stale price");
        return price;
    }
}

// ✅ Or use TWAP (Time-Weighted Average Price)
function getTWAP(uint256 period) external view returns (uint256) {
    // Uniswap V3 TWAP implementation
    // Much harder to manipulate
}
```

---

### 6. Denial of Service (DoS)

**Vulnerability**: Unbounded loops, external call failures.

**BAD** ❌:
```solidity
address[] public users;

function distributeRewards() external {
    for (uint i = 0; i < users.length; i++) {  // ❌ Unbounded loop!
        users[i].call{value: rewards[i]}("");
    }
}
```

**GOOD** ✅:
```solidity
// ✅ Pull over Push pattern
mapping(address => uint256) public rewards;

function claimReward() external {
    uint256 reward = rewards[msg.sender];
    require(reward > 0, "No reward");

    rewards[msg.sender] = 0;  // Update state first

    (bool success, ) = msg.sender.call{value: reward}("");
    require(success);
}
```

---

## Gas Optimization Techniques

### 1. Storage Optimization

**Storage is EXPENSIVE**: Reading costs 200-2100 gas, writing costs 20,000+ gas.

```solidity
// ❌ BAD: Multiple storage reads
function badCalculation() external view returns (uint256) {
    return stateVar1 + stateVar2 + stateVar3 + stateVar1;  // Reads stateVar1 twice!
}

// ✅ GOOD: Cache in memory
function goodCalculation() external view returns (uint256) {
    uint256 cached1 = stateVar1;  // Read once, cache in memory
    return cached1 + stateVar2 + stateVar3 + cached1;  // Reuse cached value
}
```

**Struct Packing**:
```solidity
// ❌ BAD: Uses 3 storage slots (96 bytes)
struct BadStruct {
    uint256 a;  // 32 bytes = 1 slot
    uint8 b;    // 1 byte = 1 slot (wastes 31 bytes!)
    uint256 c;  // 32 bytes = 1 slot
}

// ✅ GOOD: Uses 2 storage slots (64 bytes)
struct GoodStruct {
    uint256 a;  // 32 bytes = 1 slot
    uint256 c;  // 32 bytes = 1 slot
    uint8 b;    // 1 byte (packed into slot with c)
}

// ✅ BETTER: Pack tightly
struct PackedStruct {
    uint128 a;  // 16 bytes
    uint64 b;   // 8 bytes
    uint32 c;   // 4 bytes
    uint32 d;   // 4 bytes
    // Total: 32 bytes = 1 storage slot!
}
```

---

### 2. Use `calldata` for Read-Only Arrays

```solidity
// ❌ BAD: Copies array to memory (expensive for large arrays)
function badProcess(uint256[] memory data) external pure {
    // ...
}

// ✅ GOOD: Read directly from calldata
function goodProcess(uint256[] calldata data) external pure {
    // Saves ~1000 gas per array element
}
```

---

### 3. Use Custom Errors (Solidity 0.8.4+)

```solidity
// ❌ BAD: String errors cost ~4000 gas
require(balance >= amount, "Insufficient balance");

// ✅ GOOD: Custom errors cost ~200 gas
error InsufficientBalance(uint256 available, uint256 required);

if (balance < amount) {
    revert InsufficientBalance(balance, amount);
}
```

---

### 4. Use `++i` Instead of `i++` in Loops

```solidity
// ❌ BAD: i++ costs ~5 gas more per iteration
for (uint256 i = 0; i < length; i++) {
    // ...
}

// ✅ GOOD: ++i is cheaper
for (uint256 i = 0; i < length; ++i) {
    // ...
}

// ✅ BEST: Cache length, use unchecked
uint256 length = array.length;
for (uint256 i = 0; i < length;) {
    // ...

    unchecked { ++i; }  // i can't overflow in realistic scenarios
}
```

---

### 5. Use `immutable` and `constant`

```solidity
// ❌ BAD: Storage read every time (2100 gas)
address public owner;

// ✅ GOOD: Immutable (set once in constructor, inlined in bytecode)
address public immutable owner;

// ✅ BEST: Constant (known at compile time, no storage)
uint256 public constant MAX_SUPPLY = 1_000_000 * 10**18;
```

---

## Common Design Patterns

### 1. Checks-Effects-Interactions Pattern

```solidity
function withdraw(uint256 amount) external {
    // CHECKS
    require(balances[msg.sender] >= amount, "Insufficient balance");
    require(amount > 0, "Zero amount");

    // EFFECTS (update state)
    balances[msg.sender] -= amount;

    // INTERACTIONS (external calls LAST)
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

---

### 2. Pull Over Push Pattern

**Avoid pushing funds to users** (DoS risk). Let them **pull** instead.

```solidity
mapping(address => uint256) public pendingWithdrawals;

// Step 1: Mark funds available for withdrawal
function makeAvailable(address user, uint256 amount) internal {
    pendingWithdrawals[user] += amount;
}

// Step 2: User pulls their funds
function withdraw() external {
    uint256 amount = pendingWithdrawals[msg.sender];
    require(amount > 0, "Nothing to withdraw");

    pendingWithdrawals[msg.sender] = 0;

    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
```

---

### 3. Emergency Stop (Circuit Breaker)

```solidity
import "@openzeppelin/contracts/security/Pausable.sol";

contract MyContract is Pausable, Ownable {
    function deposit() external payable whenNotPaused {
        // Normal operation
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function resume() external onlyOwner {
        _unpause();
    }

    // Emergency withdrawal (works even when paused)
    function emergencyWithdraw() external {
        uint256 balance = balances[msg.sender];
        balances[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: balance}("");
        require(success);
    }
}
```

---

## NatSpec Documentation Standards

**Always use NatSpec for documentation**:

```solidity
/// @title A simulator for trees
/// @author Larry A. Gardner
/// @notice You can use this contract for only the most basic simulation
/// @dev All function calls are currently implemented without side effects
contract Tree {
    /// @notice Calculate tree age in years, rounded up, for live trees
    /// @dev The Alexandr N. Tetearing algorithm could increase precision
    /// @param rings The number of rings from dendrochronological sample
    /// @return age in years, rounded up for partial years
    function age(uint256 rings) external pure returns (uint256) {
        return rings + 1;
    }
}
```

**NatSpec Tags**:
- `@title`: Contract name
- `@author`: Author name
- `@notice`: End-user explanation
- `@dev`: Developer notes
- `@param`: Parameter description
- `@return`: Return value description
- `@inheritdoc`: Inherit documentation from parent

---

## Chain-Specific Considerations

### Ethereum Mainnet
- **Gas**: Expensive (~$50-$200 for complex transactions)
- **Block Time**: ~12 seconds
- **Finality**: ~15 minutes (probabilistic)
- **Optimization**: Critical - every optimization matters
- **Use Case**: High-value, decentralized applications

### BSC (Binance Smart Chain)
- **Gas**: Cheap (~$0.10-$0.50 per transaction)
- **Block Time**: ~3 seconds
- **Finality**: Fast (~75 seconds)
- **Optimization**: Still important but less critical
- **Differences**:
  - Fewer validators (more centralized)
  - Compatible with Ethereum tooling
- **Use Case**: DeFi for cost-sensitive users

### Avalanche C-Chain
- **Gas**: Moderate (~$0.50-$2.00)
- **Block Time**: ~2 seconds
- **Finality**: Very fast (~1-2 seconds)
- **Optimization**: Moderate importance
- **Differences**:
  - Subnet architecture available
  - Very fast finality
- **Use Case**: High-throughput DeFi, gaming

---

## Testing Requirements

**MANDATORY for all contracts**:

1. **Unit Tests**: Every public function
2. **Coverage**: Minimum 90%
3. **Framework**: Foundry (preferred) or Hardhat
4. **Security**: Slither + Mythril before deployment

**Test Template (Foundry)**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MyContract.sol";

contract MyContractTest is Test {
    MyContract public myContract;
    address public alice = address(0x1);
    address public bob = address(0x2);

    function setUp() public {
        myContract = new MyContract();
    }

    function testDeposit() public {
        vm.prank(alice);
        vm.deal(alice, 1 ether);

        myContract.deposit{value: 0.5 ether}();

        assertEq(myContract.balanceOf(alice), 0.5 ether);
    }

    function testCannotDepositZero() public {
        vm.expectRevert(MyContract.ZeroAmount.selector);
        myContract.deposit{value: 0}();
    }

    function testFuzz_deposit(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(alice, amount);
        vm.prank(alice);

        myContract.deposit{value: amount}();

        assertEq(myContract.balanceOf(alice), amount);
    }
}
```

---

## Quick Reference: Common OpenZeppelin Imports

```solidity
// Access Control
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// Security
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

// Tokens
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

// Utils
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

// Upgradeable
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
```

---

## Security Checklist

Before deploying ANY contract:

- [ ] Using Solidity 0.8.20+
- [ ] All functions have NatSpec documentation
- [ ] ReentrancyGuard on functions with external calls
- [ ] Pausable pattern for emergency stops
- [ ] Access control via Ownable or AccessControl
- [ ] Custom errors instead of string reverts
- [ ] No unbounded loops
- [ ] Storage variables packed efficiently
- [ ] `calldata` used for read-only arrays
- [ ] `immutable` and `constant` used where possible
- [ ] Slither scan passed (0 HIGH/CRITICAL)
- [ ] Mythril scan passed (0 HIGH/CRITICAL)
- [ ] Test coverage >90%
- [ ] All tests passing

---

## Activation

This skill activates automatically when:
- Editing `.sol` or `.vy` files
- Keywords detected: solidity, smart contract, ethereum, evm, gas optimization
- contract-developer subagent is active

**Load time**: ~100 tokens (metadata only), ~800 tokens (full content when activated)

---

**Skill Version**: 1.0.0
**Last Updated**: 2025-11-12
**Maintained By**: BlockchainOrchestra Framework
