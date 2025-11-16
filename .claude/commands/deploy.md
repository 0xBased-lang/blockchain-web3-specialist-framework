---
description: Deploy smart contracts to testnets or mainnet with security checks and verification
---

# Deploy Smart Contract

You are now in deployment mode. Guide the user through safe, secure contract deployment.

## Task

Deploy the specified smart contract to the target network with comprehensive pre-deployment checks.

## Mandatory Pre-Deployment Steps

1. **Security Audit** (REQUIRED)
   - Use ContractAnalyzer subagent
   - Check for critical vulnerabilities
   - STOP if critical issues found
   - Warn on high severity issues

2. **Gas Estimation**
   - Use GasOptimizer subagent
   - Estimate deployment cost
   - Verify deployer has sufficient funds
   - Add 20% buffer for safety

3. **Network Verification**
   - ALWAYS deploy to testnet first
   - Verify RPC endpoint
   - Check network congestion
   - Confirm correct chain ID

4. **Constructor Validation**
   - Verify all constructor arguments
   - Check argument types and formats
   - Validate addresses (checksummed)
   - Confirm values are correct

## Deployment Workflow

### Phase 1: Preparation
```
1. Locate contract file
2. Compile with Hardhat
3. Verify compilation successful
4. Extract ABI and bytecode
```

### Phase 2: Security Check
```
5. Run security analysis
6. Review findings
7. Require fixes for critical issues
8. Document medium/low issues
```

### Phase 3: Testnet Deployment
```
9. Deploy to Sepolia (Ethereum) or Devnet (Solana)
10. Wait for confirmation (6+ blocks)
11. Verify deployment
12. Test deployed contract
13. Verify on block explorer
```

### Phase 4: Mainnet (Only if testnet successful)
```
14. Show deployment checklist
15. Require explicit confirmation
16. Deploy with higher gas for speed
17. Monitor transaction
18. Verify on Etherscan
19. Document deployment
```

## Safety Rules

⚠️ NEVER:
- Deploy to mainnet without testnet verification
- Deploy contracts with critical vulnerabilities
- Use production keys without hardware wallet
- Skip security analysis

✓ ALWAYS:
- Run security audit first
- Deploy to testnet before mainnet
- Verify contracts on block explorers
- Keep deployment records
- Test thoroughly after deployment

## Example Usage

User: "/deploy contracts/MyToken.sol --network sepolia --args 'MyToken' 'MTK' 1000000"

Execute:
1. Read MyToken.sol
2. Compile with Hardhat
3. Run ContractAnalyzer
4. Estimate gas cost
5. Deploy to Sepolia
6. Verify on Etherscan
7. Provide deployment summary

## Use Skills

- Activate `security-audit` skill for pre-deployment analysis
- Activate `contract-deploy` skill for actual deployment
- Use `blockchain-query` skill to verify deployment

Ensure user understands risks and has backups before mainnet deployment.
