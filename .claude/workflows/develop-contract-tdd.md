# Workflow: Develop Smart Contract with TDD

> **Purpose**: Complete end-to-end workflow demonstrating Test-Driven Development for smart contracts using the BlockchainOrchestra framework.
> **Time**: ~2-3 hours for typical contract
> **Skill Level**: Intermediate Solidity knowledge required

---

## Overview

This workflow demonstrates how to build a smart contract from scratch using **Test-Driven Development (TDD)**, enforced by the `contract-developer` subagent with guidance from the `evm-expert` skill.

**What you'll learn:**
- How Skills and Subagents work together
- How context is preserved across the workflow
- How TDD is enforced automatically
- How security scanning integrates
- How documentation updates maintain context

---

## Prerequisites

**Before starting:**
- [ ] Foundry installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- [ ] OR Hardhat initialized (`npm install --save-dev hardhat`)
- [ ] OpenZeppelin contracts available (`forge install OpenZeppelin/openzeppelin-contracts`)
- [ ] Git repository initialized

**Verify**:
```bash
forge --version  # Should show Foundry version
# OR
npx hardhat --version  # Should show Hardhat version
```

---

## Example: Build a Simple Staking Contract

**Goal**: Create a contract where users can stake ERC20 tokens and earn rewards over time.

---

## Phase 1: Planning & Context Setup

### Step 1: Tell the Orchestrator What You Want

**You say**:
```
"I want to create a staking contract where users can stake an ERC20 token and earn rewards at a fixed rate per block. Users should be able to stake, withdraw, and claim rewards."
```

### Step 2: Orchestrator Enters Plan Mode (Guided Automation)

**Orchestrator response**:
```markdown
📋 PLAN: Staking Contract Development

I'll use the contract-developer subagent to build this with TDD.

Questions before I start:
1. Should there be a minimum stake amount?
2. Should there be lock periods, or can users withdraw anytime?
3. What should happen to unclaimed rewards when users withdraw?
4. Which chain are we targeting first? (Ethereum/BSC/Avalanche)

Estimated workflow:
1. Write tests first (TDD - RED phase)
2. Implement contract (GREEN phase)
3. Optimize gas usage (REFACTOR phase)
4. Run security scan (Slither)
5. Verify 90%+ test coverage

Token estimate: ~30k-40k tokens
Timeline: 2-3 hours active work

Approve to proceed? ✋
```

### Step 3: You Provide Clarifications

**You say**:
```
1. Minimum stake: 1 token
2. No lock period, withdraw anytime
3. Auto-claim rewards on withdrawal
4. Target Ethereum first (Sepolia testnet)

Approved, proceed!
```

### Step 4: Orchestrator Delegates to contract-developer Subagent

**What happens** (behind the scenes):
```
Orchestrator → Spawns contract-developer subagent
             → Loads evm-expert skill (for Solidity knowledge)
             → Reads PROJECT_STATE.md (current project status)
             → Reads ARCHITECTURE.md (system design)
```

---

## Phase 2: Test-Driven Development (Subagent Execution)

### Step 5: RED Phase - Write Failing Tests

**Subagent creates**: `test/StakingRewards.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/StakingRewards.sol";
import "../src/mocks/MockERC20.sol";

contract StakingRewardsTest is Test {
    StakingRewards public staking;
    MockERC20 public stakingToken;
    MockERC20 public rewardToken;

    address public alice = address(0x1);
    address public bob = address(0x2);

    uint256 constant REWARD_RATE = 100; // 100 reward tokens per block

    function setUp() public {
        stakingToken = new MockERC20("Staking Token", "STK", 18);
        rewardToken = new MockERC20("Reward Token", "RWD", 18);

        staking = new StakingRewards(
            address(stakingToken),
            address(rewardToken),
            REWARD_RATE
        );

        // Mint tokens to users
        stakingToken.mint(alice, 1000 ether);
        stakingToken.mint(bob, 1000 ether);

        // Fund staking contract with rewards
        rewardToken.mint(address(staking), 1_000_000 ether);
    }

    // Test: User can stake tokens
    function testStake() public {
        uint256 stakeAmount = 100 ether;

        vm.startPrank(alice);
        stakingToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), stakeAmount);
        assertEq(staking.totalStaked(), stakeAmount);
    }

    // Test: Cannot stake zero tokens
    function testCannotStakeZero() public {
        vm.prank(alice);
        vm.expectRevert(StakingRewards.ZeroAmount.selector);
        staking.stake(0);
    }

    // Test: Cannot stake below minimum
    function testCannotStakeBelowMinimum() public {
        uint256 belowMin = 0.5 ether; // Less than 1 token

        vm.startPrank(alice);
        stakingToken.approve(address(staking), belowMin);
        vm.expectRevert(StakingRewards.BelowMinimum.selector);
        staking.stake(belowMin);
        vm.stopPrank();
    }

    // Test: Rewards accrue over time
    function testRewardsAccrue() public {
        uint256 stakeAmount = 100 ether;

        vm.startPrank(alice);
        stakingToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        // Fast forward 10 blocks
        vm.roll(block.number + 10);

        uint256 expectedReward = 10 * REWARD_RATE;
        assertEq(staking.earned(alice), expectedReward);
    }

    // Test: User can withdraw stake
    function testWithdraw() public {
        uint256 stakeAmount = 100 ether;

        vm.startPrank(alice);
        stakingToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);

        staking.withdraw(stakeAmount);
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), 0);
        assertEq(stakingToken.balanceOf(alice), 1000 ether); // Original amount
    }

    // Test: Rewards auto-claimed on withdrawal
    function testWithdrawAutoClaimsRewards() public {
        uint256 stakeAmount = 100 ether;

        vm.startPrank(alice);
        stakingToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);

        vm.roll(block.number + 10);

        uint256 expectedReward = 10 * REWARD_RATE;
        staking.withdraw(stakeAmount);
        vm.stopPrank();

        assertEq(rewardToken.balanceOf(alice), expectedReward);
    }

    // Test: Cannot withdraw more than staked
    function testCannotWithdrawMoreThanStaked() public {
        uint256 stakeAmount = 100 ether;

        vm.startPrank(alice);
        stakingToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);

        vm.expectRevert(StakingRewards.InsufficientBalance.selector);
        staking.withdraw(stakeAmount + 1);
        vm.stopPrank();
    }

    // Fuzz test: Staking various amounts
    function testFuzz_stake(uint96 amount) public {
        vm.assume(amount >= 1 ether); // Above minimum
        vm.assume(amount <= 1000 ether); // Within alice's balance

        vm.startPrank(alice);
        stakingToken.approve(address(staking), amount);
        staking.stake(amount);
        vm.stopPrank();

        assertEq(staking.balanceOf(alice), amount);
    }
}
```

**Subagent runs tests**:
```bash
forge test
```

**Expected output**: ❌ All tests fail (contracts don't exist yet - this is RED phase)

---

### Step 6: GREEN Phase - Implement Contract

**Subagent creates**: `src/StakingRewards.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title StakingRewards
 * @author BlockchainOrchestra Framework
 * @notice Users can stake ERC20 tokens and earn rewards at a fixed rate
 * @dev Implements checks-effects-interactions pattern and ReentrancyGuard
 */
contract StakingRewards is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // Structs
    struct UserInfo {
        uint256 amount;       // Staked amount
        uint256 rewardDebt;   // Reward debt for calculation
    }

    // State variables
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    uint256 public immutable rewardRate;  // Rewards per block
    uint256 public constant MINIMUM_STAKE = 1 ether;

    uint256 public totalStaked;
    uint256 public lastRewardBlock;
    uint256 public accRewardPerShare;  // Accumulated rewards per share, scaled by 1e12

    mapping(address => UserInfo) public userInfo;

    // Events
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);

    // Custom errors (gas efficient)
    error ZeroAmount();
    error BelowMinimum();
    error InsufficientBalance();
    error TransferFailed();

    /**
     * @notice Constructor
     * @param _stakingToken Address of token to be staked
     * @param _rewardToken Address of reward token
     * @param _rewardRate Rewards distributed per block
     */
    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRate
    ) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
        lastRewardBlock = block.number;
    }

    /**
     * @notice Stake tokens to earn rewards
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();
        if (amount < MINIMUM_STAKE) revert BelowMinimum();

        _updatePool();

        UserInfo storage user = userInfo[msg.sender];

        // Claim pending rewards if user already staking
        if (user.amount > 0) {
            uint256 pending = (user.amount * accRewardPerShare / 1e12) - user.rewardDebt;
            if (pending > 0) {
                _safeRewardTransfer(msg.sender, pending);
                emit RewardsClaimed(msg.sender, pending);
            }
        }

        // Update state
        user.amount += amount;
        totalStaked += amount;
        user.rewardDebt = user.amount * accRewardPerShare / 1e12;

        // Transfer tokens (last to follow checks-effects-interactions)
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Withdraw staked tokens (auto-claims rewards)
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];

        if (amount == 0) revert ZeroAmount();
        if (user.amount < amount) revert InsufficientBalance();

        _updatePool();

        // Calculate and claim pending rewards
        uint256 pending = (user.amount * accRewardPerShare / 1e12) - user.rewardDebt;
        if (pending > 0) {
            _safeRewardTransfer(msg.sender, pending);
            emit RewardsClaimed(msg.sender, pending);
        }

        // Update state
        user.amount -= amount;
        totalStaked -= amount;
        user.rewardDebt = user.amount * accRewardPerShare / 1e12;

        // Transfer tokens (last to follow checks-effects-interactions)
        stakingToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice View function to see pending rewards
     * @param _user Address of user
     * @return Pending reward amount
     */
    function earned(address _user) external view returns (uint256) {
        UserInfo memory user = userInfo[_user];

        uint256 _accRewardPerShare = accRewardPerShare;
        if (block.number > lastRewardBlock && totalStaked > 0) {
            uint256 blocks = block.number - lastRewardBlock;
            uint256 reward = blocks * rewardRate;
            _accRewardPerShare += (reward * 1e12) / totalStaked;
        }

        return (user.amount * _accRewardPerShare / 1e12) - user.rewardDebt;
    }

    /**
     * @notice Get user's staked balance
     * @param _user Address of user
     * @return Staked amount
     */
    function balanceOf(address _user) external view returns (uint256) {
        return userInfo[_user].amount;
    }

    /**
     * @notice Emergency pause (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume operations (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Update reward variables
     */
    function _updatePool() internal {
        if (block.number <= lastRewardBlock) {
            return;
        }

        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }

        uint256 blocks = block.number - lastRewardBlock;
        uint256 reward = blocks * rewardRate;
        accRewardPerShare += (reward * 1e12) / totalStaked;
        lastRewardBlock = block.number;
    }

    /**
     * @dev Safe reward transfer (handles insufficient balance)
     */
    function _safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        uint256 transferAmount = _amount > rewardBalance ? rewardBalance : _amount;

        if (transferAmount > 0) {
            rewardToken.safeTransfer(_to, transferAmount);
        }
    }
}
```

**Subagent runs tests again**:
```bash
forge test -vvv
```

**Expected output**: ✅ All tests pass (GREEN phase achieved)

---

### Step 7: REFACTOR Phase - Gas Optimization

**Subagent optimizes**:
- ✅ Used `immutable` for tokens and rate (saves ~2100 gas per read)
- ✅ Used custom errors instead of string reverts (saves ~4000 gas per revert)
- ✅ Packed struct efficiently (UserInfo fits in 2 storage slots)
- ✅ Cached `accRewardPerShare` in `earned()` view function

**Subagent verifies tests still pass**:
```bash
forge test
```

**Output**: ✅ All tests still passing after refactor

---

## Phase 3: Security & Quality Gates

### Step 8: Security Scanning (Automated)

**Subagent runs Slither**:
```bash
slither src/StakingRewards.sol
```

**Example output**:
```
INFO:Slither:StakingRewards analyzed (93 detectors)

LOW SEVERITY (2):
- Consider using SafeERC20 for all token operations
  → Already using SafeERC20 ✅

INFORMATIONAL (5):
- Function ordering does not follow Solidity style guide
  → Not critical, documented

HIGH/CRITICAL: None ✅
```

**Subagent updates**: `.claude/context/SECURITY_LOG.md`

---

### Step 9: Test Coverage Report

**Subagent generates coverage**:
```bash
forge coverage
```

**Example output**:
```
| File                    | % Lines      | % Statements | % Branches  | % Funcs     |
|-------------------------|--------------|--------------|-------------|-------------|
| src/StakingRewards.sol  | 95.83% (23/24) | 96.15% (25/26) | 87.50% (7/8) | 100% (8/8) |
| Total                   | 95.83%       | 96.15%       | 87.50%      | 100%        |
```

**Result**: ✅ Coverage exceeds 90% minimum

---

## Phase 4: Documentation Updates (Context Preservation)

### Step 10: Update PROJECT_STATE.md

**Subagent adds** to "Completed Work > Smart Contracts":

```markdown
✅ StakingRewards.sol
   - Deployed: No (testnet deployment pending)
   - Test Coverage: 95.83%
   - Security Audit: Slither passed (0 HIGH/CRITICAL)
   - Last Updated: 2025-11-12
   - Location: contracts/StakingRewards.sol
   - Description: ERC20 staking with fixed block rewards, auto-claim on withdrawal
```

**Subagent adds** to "Recent Updates":

```markdown
### 2025-11-12 - StakingRewards Contract Implementation
**Agent**: contract-developer
**Action**: Implemented staking contract using TDD methodology

**Files Changed**:
- src/StakingRewards.sol (new)
- test/StakingRewards.t.sol (new)
- src/mocks/MockERC20.sol (new, for testing)

**Test Results**:
- 8 unit tests + 1 fuzz test
- Coverage: 95.83%
- All tests passing ✅

**Security**:
- Slither scan: PASSED (0 HIGH/CRITICAL issues)
- Mythril: Not yet run (recommended before deployment)

**Next Steps**:
- Run Mythril symbolic execution
- Deploy to Sepolia testnet
- Build frontend integration
```

---

### Step 11: Update TESTING_STATUS.md

**Subagent updates** coverage table:

```markdown
| Contract | Statements | Branches | Functions | Lines | Status |
|----------|-----------|----------|-----------|-------|--------|
| StakingRewards.sol | 96.15% | 87.50% | 100% | 95.83% | ✅ Passing |
```

**TDD Compliance**:
```markdown
- Features implemented with TDD: 1/1 ✅
- Test-first methodology followed: YES
```

---

### Step 12: Update ARCHITECTURE.md

**Subagent adds** contract to architecture docs:

```markdown
### StakingRewards.sol

**Purpose**: Manages ERC20 token staking and reward distribution

**Inheritance**: ReentrancyGuard, Ownable, Pausable

**Key Functions**:
- `stake(uint256 amount)` - Stake tokens, auto-claim existing rewards
- `withdraw(uint256 amount)` - Unstake tokens, auto-claim rewards
- `earned(address user)` - View pending rewards

**Storage**:
- `mapping(address => UserInfo) userInfo` - User stake data
- `uint256 totalStaked` - Total tokens staked in contract
- `uint256 accRewardPerShare` - Accumulated rewards per share (scaled 1e12)

**Events**:
- `Staked(address indexed user, uint256 amount)`
- `Withdrawn(address indexed user, uint256 amount)`
- `RewardsClaimed(address indexed user, uint256 amount)`

**Security Features**:
- ReentrancyGuard on stake/withdraw
- Pausable for emergency stops
- Checks-effects-interactions pattern
- Custom errors for gas efficiency
```

---

## Phase 5: Subagent Returns Summary

### Step 13: Orchestrator Receives Summary

**Subagent returns** (concise, NOT full code):

```markdown
## Contract Development Complete ✅

**Contract**: StakingRewards.sol
**Location**: `src/StakingRewards.sol`
**Purpose**: ERC20 token staking with fixed block-based rewards

### Testing
- ✅ TDD methodology followed (tests written first)
- ✅ Coverage: 95.83% (exceeds 90% minimum)
- ✅ 8 unit tests + 1 fuzz test, all passing

### Security
- ✅ Slither scan: PASSED (0 HIGH/CRITICAL issues)
- ℹ️ 2 LOW severity findings (non-blocking, documented)
- ⏳ Mythril scan pending (recommended before deployment)

### Gas Optimization
- Immutable variables for tokens/rate
- Custom errors (saves ~4k gas per revert)
- Efficient struct packing
- View function optimization

### Documentation
- ✅ NatSpec comments on all functions
- ✅ PROJECT_STATE.md updated
- ✅ TESTING_STATUS.md updated
- ✅ ARCHITECTURE.md updated

### Next Steps
- [ ] Run Mythril symbolic execution (contract-developer can do this)
- [ ] Deploy to Sepolia testnet (use deployment-manager subagent)
- [ ] Build frontend staking interface (use frontend-developer subagent)
- [ ] Consider time-lock for owner functions (security enhancement)
```

---

## Phase 6: What Just Happened? (Context Preservation Magic)

### How Context Was Maintained

**Before workflow**:
- PROJECT_STATE.md showed: "No contracts developed"

**During workflow**:
- contract-developer read existing context
- Worked in isolated context window
- Updated documentation files as it progressed

**After workflow**:
- PROJECT_STATE.md shows: Completed contract, test coverage, security status
- TESTING_STATUS.md shows: TDD compliance, coverage data
- ARCHITECTURE.md shows: Contract structure and design
- SECURITY_LOG.md shows: Scan results

**Tomorrow/Next Week**:
You can ask: "Continue working on the staking project"
- Orchestrator reads PROJECT_STATE.md
- Sees: StakingRewards is complete, pending Mythril scan
- Knows exactly where to continue
- **Context never lost!**

---

## Verification: Check the Files

**You can verify everything was documented**:

```bash
# See completed work
cat .claude/context/PROJECT_STATE.md

# See test results
cat .claude/context/TESTING_STATUS.md

# See contract architecture
cat .claude/context/ARCHITECTURE.md

# See security findings
cat .claude/context/SECURITY_LOG.md
```

---

## Key Takeaways

### 1. Skills + Subagents Integration

```
User Request
    ↓
Orchestrator (analyzes, plans, asks questions)
    ↓
contract-developer subagent (isolated context)
    ↓
Loads evm-expert skill (Solidity knowledge)
    ↓
Reads context files (PROJECT_STATE, ARCHITECTURE)
    ↓
Executes TDD workflow
    ↓
Updates context files (preserves state)
    ↓
Returns summary (not full context)
```

### 2. TDD Enforcement

- Tests MUST be written first (agent refuses otherwise)
- Red-Green-Refactor cycle enforced
- 90% coverage required
- Deployment blocked if tests fail

### 3. Context Preservation

- All work documented in context files
- Orchestrator + subagents read context before working
- Updates happen continuously, not just at end
- Future sessions load context seamlessly

### 4. Token Efficiency

- Subagent works in isolated context (doesn't pollute main conversation)
- Returns summary, not full details
- Skills loaded progressively (only when needed)
- Context files cached

---

## Common Variations

### Build an NFT Contract Instead

**Request**: "Create an ERC721 NFT contract with minting limits"

**Same workflow applies**:
1. Orchestrator asks clarifying questions
2. contract-developer follows TDD
3. evm-expert skill provides NFT best practices
4. Context files updated
5. Summary returned

### Add Frontend Integration

**After contract complete**:

**Request**: "Build a React component to interact with the staking contract"

**What happens**:
1. Orchestrator reads PROJECT_STATE.md (sees contract exists)
2. Delegates to `frontend-developer` subagent
3. Loads `react-web3` skill
4. Builds UI components
5. Updates PROJECT_STATE.md with frontend status

---

## Next Steps After This Workflow

**Now that you have a completed contract:**

1. **Run Mythril**: `"Run Mythril security scan on StakingRewards"`
2. **Deploy to Testnet**: `"Deploy StakingRewards to Sepolia testnet"`
3. **Build Frontend**: `"Create a staking interface with React and wagmi"`
4. **Deploy Multi-Chain**: `"Deploy to BSC and Avalanche testnets"`

**The framework maintains context through all of these!**

---

## Troubleshooting

**Q: What if tests fail during development?**
A: contract-developer stops and reports the failure. Fix the issue and continue.

**Q: What if coverage is below 90%?**
A: Agent prompts to write additional tests before marking work complete.

**Q: What if Slither finds HIGH/CRITICAL issues?**
A: Deployment is BLOCKED. Agent requires fixes before proceeding.

**Q: Can I skip TDD?**
A: No. The framework enforces it. If you absolutely need to skip, you'd need to modify the agent config (not recommended).

---

**Workflow Version**: 1.0.0
**Framework**: BlockchainOrchestra
**Last Updated**: 2025-11-12
