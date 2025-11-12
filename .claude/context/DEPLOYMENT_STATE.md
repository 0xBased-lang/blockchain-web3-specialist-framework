# Deployment State

> **Purpose**: Track multi-chain deployment status, contract addresses, verification status, and deployment history.
> **Updated by**: deployment-manager subagent
> **Read by**: All agents when working with deployed contracts

---

## Multi-Chain Deployment Overview

**Project**: [Not initialized]

**Deployment Strategy**: Semi-automated (testnet auto, mainnet manual approval)

**Total Contracts**: 0
**Total Deployments**: 0

---

## Deployment Status by Chain

### Ethereum

**Network**: Not deployed

**Testnet Deployments** (Sepolia):

| Contract | Address | Deployed | Block | Verified | Status |
|----------|---------|----------|-------|----------|--------|
| - | - | - | - | - | - |

**Mainnet Deployments**:

| Contract | Address | Deployed | Block | Verified | Status |
|----------|---------|----------|-------|----------|--------|
| - | - | - | - | - | - |

**RPC Configuration**:
- Testnet: `env.ETHEREUM_SEPOLIA_RPC`
- Mainnet: `env.ETHEREUM_MAINNET_RPC`

---

### Solana

**Network**: Not deployed

**Devnet Deployments**:

| Program | Address | Deployed | Slot | Verified | Status |
|---------|---------|----------|------|----------|--------|
| - | - | - | - | - | - |

**Mainnet Deployments**:

| Program | Address | Deployed | Slot | Verified | Status |
|---------|---------|----------|------|----------|--------|
| - | - | - | - | - | - |

**RPC Configuration**:
- Devnet: `env.SOLANA_DEVNET_RPC`
- Mainnet: `env.SOLANA_MAINNET_RPC`

---

### BSC (Binance Smart Chain)

**Network**: Not deployed

**Testnet Deployments** (BSC Testnet):

| Contract | Address | Deployed | Block | Verified | Status |
|----------|---------|----------|-------|----------|--------|
| - | - | - | - | - | - |

**Mainnet Deployments**:

| Contract | Address | Deployed | Block | Verified | Status |
|----------|---------|----------|-------|----------|--------|
| - | - | - | - | - | - |

**RPC Configuration**:
- Testnet: `env.BSC_TESTNET_RPC`
- Mainnet: `env.BSC_MAINNET_RPC`

---

### Avalanche

**Network**: Not deployed

**Testnet Deployments** (Fuji):

| Contract | Address | Deployed | Block | Verified | Status |
|----------|---------|----------|-------|----------|--------|
| - | - | - | - | - | - |

**Mainnet Deployments** (C-Chain):

| Contract | Address | Deployed | Block | Verified | Status |
|----------|---------|----------|-------|----------|--------|
| - | - | - | - | - | - |

**RPC Configuration**:
- Testnet: `env.AVALANCHE_FUJI_RPC`
- Mainnet: `env.AVALANCHE_MAINNET_RPC`

---

## Deployment History

### Example Entry (Template)

```markdown
### 2025-11-12 - StakingRewards Deployment (Sepolia)

**Chain**: Ethereum Sepolia Testnet
**Contract**: StakingRewards.sol
**Address**: 0x1234567890abcdef1234567890abcdef12345678
**Deployer**: 0xabcd...
**Transaction**: 0xdeadbeef...
**Block**: 5,123,456
**Gas Used**: 2,345,678
**Verification**: ✅ Verified on Etherscan

**Constructor Arguments**:
- rewardToken: 0x...
- stakingToken: 0x...
- rewardRate: 100 (per block)

**Post-Deployment Actions**:
- ✅ Contract verified on Etherscan
- ✅ Ownership transferred to multi-sig
- ✅ Integration tests passed
- ✅ Frontend updated with new address

**Notes**: Initial deployment for testing reward mechanics.
```

---

## Deployment Checklist

### Pre-Deployment

**For each deployment, verify:**

- [ ] **Tests Passing** - All unit and integration tests pass
- [ ] **Security Audit Complete** - Check SECURITY_LOG.md
- [ ] **Test Coverage** - Minimum 90% achieved
- [ ] **Constructor Parameters** - Verified and documented
- [ ] **Gas Estimation** - Deployment cost estimated
- [ ] **Network Configuration** - RPC and private key configured
- [ ] **Deployer Account** - Sufficient balance for gas

### During Deployment

- [ ] **Dry Run** - Test deployment on local fork
- [ ] **Deploy to Testnet** - Deploy to appropriate testnet first
- [ ] **Verify Deployment** - Call view functions to confirm
- [ ] **Verify Contract** - Submit source code to block explorer
- [ ] **Test Interactions** - Execute basic operations

### Post-Deployment

- [ ] **Update This File** - Add deployment details to tables above
- [ ] **Update PROJECT_STATE.md** - Note deployment completion
- [ ] **Update Frontend** - If applicable, update contract addresses
- [ ] **Document Explorer Links** - Add block explorer URLs
- [ ] **Run Integration Tests** - Test against deployed contracts
- [ ] **Transfer Ownership** - If using Ownable pattern
- [ ] **Announce Deployment** - If public project

---

## Environment Variables

### Required Configuration

**Template** (.env file):

```bash
# Ethereum
ETHEREUM_SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY
ETHEREUM_MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_KEY

# Solana
SOLANA_DEVNET_RPC=https://api.devnet.solana.com
SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com

# BSC
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/

# Avalanche
AVALANCHE_FUJI_RPC=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_MAINNET_RPC=https://api.avax.network/ext/bc/C/rpc

# Private Keys (NEVER COMMIT THESE)
DEPLOYER_PRIVATE_KEY=0x...
TESTNET_PRIVATE_KEY=0x...

# Block Explorer API Keys (for verification)
ETHERSCAN_API_KEY=your_key_here
BSCSCAN_API_KEY=your_key_here
SNOWTRACE_API_KEY=your_key_here
```

**Security Note**: ⚠️ Never commit private keys to git. Use `.env` file in `.gitignore`.

---

## Contract Addresses Quick Reference

### Testnet Addresses

**Purpose**: For development and testing

```json
{
  "ethereum_sepolia": {
    "StakingRewards": "0x...",
    "RewardToken": "0x..."
  },
  "solana_devnet": {
    "staking_program": "...",
    "reward_mint": "..."
  },
  "bsc_testnet": {
    "StakingRewards": "0x...",
    "RewardToken": "0x..."
  },
  "avalanche_fuji": {
    "StakingRewards": "0x...",
    "RewardToken": "0x..."
  }
}
```

### Mainnet Addresses

**Purpose**: Production deployments

```json
{
  "ethereum": {
    "StakingRewards": "0x...",
    "RewardToken": "0x..."
  },
  "solana": {
    "staking_program": "...",
    "reward_mint": "..."
  },
  "bsc": {
    "StakingRewards": "0x...",
    "RewardToken": "0x..."
  },
  "avalanche": {
    "StakingRewards": "0x...",
    "RewardToken": "0x..."
  }
}
```

---

## Block Explorer Links

### Ethereum
- **Mainnet**: https://etherscan.io/address/[CONTRACT_ADDRESS]
- **Sepolia**: https://sepolia.etherscan.io/address/[CONTRACT_ADDRESS]

### Solana
- **Mainnet**: https://solscan.io/account/[PROGRAM_ADDRESS]
- **Devnet**: https://solscan.io/account/[PROGRAM_ADDRESS]?cluster=devnet

### BSC
- **Mainnet**: https://bscscan.com/address/[CONTRACT_ADDRESS]
- **Testnet**: https://testnet.bscscan.com/address/[CONTRACT_ADDRESS]

### Avalanche
- **C-Chain**: https://snowtrace.io/address/[CONTRACT_ADDRESS]
- **Fuji**: https://testnet.snowtrace.io/address/[CONTRACT_ADDRESS]

---

## Deployment Scripts

### Location

**Hardhat**: `scripts/deploy-[network].ts`
**Foundry**: `script/Deploy.s.sol`
**Anchor**: `migrations/deploy.ts`

### Example Deployment Command

```bash
# Ethereum (Hardhat)
npx hardhat run scripts/deploy-ethereum.ts --network sepolia

# Ethereum (Foundry)
forge script script/Deploy.s.sol --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast

# Solana (Anchor)
anchor deploy --provider.cluster devnet
```

---

## Upgrade History

**If using upgradeable contracts:**

### Example Entry (Template)

```markdown
### 2025-11-15 - StakingRewards v1.1 Upgrade

**Chain**: Ethereum Mainnet
**Proxy Address**: 0x... (unchanged)
**New Implementation**: 0x...
**Previous Implementation**: 0x...
**Upgrade Transaction**: 0x...
**Upgrade Reason**: Added emergency withdrawal function

**Changes**:
- Added: emergencyWithdraw() function
- Fixed: Reward calculation bug
- Optimized: Gas usage in stake() function

**Testing**: All tests passed on forked mainnet
**Audit**: Security review completed (see SECURITY_LOG.md)
```

---

## Instructions for Agents

**When deploying contracts:**

1. ✅ Follow pre-deployment checklist completely
2. ✅ Deploy to testnet first, always
3. ✅ Update tables above with deployment details
4. ✅ Add entry to Deployment History
5. ✅ Verify contract on block explorer
6. ✅ Update PROJECT_STATE.md
7. ✅ Run post-deployment tests

**When querying deployment info:**

1. 📖 Check tables for contract addresses
2. 📖 Verify deployment status before proceeding
3. 📖 Use block explorer links for verification

---

**Last Updated**: [Not yet initialized]
**Updated By**: System (template)
