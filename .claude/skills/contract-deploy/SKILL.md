---
name: contract-deploy
description: Deploy and verify smart contracts on Ethereum and Solana with security checks and gas optimization
allowed-tools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob"]
argument-hint: "contract file path or deployment request"
model: sonnet
---

# Contract Deploy Skill

## Activation Triggers

Activate this skill when the user:
- Asks to deploy a smart contract
- Provides a Solidity (.sol) or Rust (.rs) contract file
- Mentions "deploy", "deployment", "publish contract"
- Wants to verify a deployed contract
- Asks about deployment configuration

## When to Use

Activate this skill when the user wants to:
- Deploy Solidity contracts to Ethereum/EVM chains
- Deploy Solana programs
- Verify contracts on Etherscan/block explorers
- Configure deployment parameters (gas, network, constructor args)
- Test contracts before mainnet deployment
- Deploy proxy/upgradeable contracts

## Capabilities

- **Multi-chain deployment**: Ethereum, Polygon, Arbitrum, Optimism, Solana
- **Security pre-checks**: Automatic security analysis before deployment
- **Gas optimization**: Optimize deployment gas costs
- **Constructor validation**: Validate constructor arguments
- **Verification**: Auto-verify on Etherscan-like explorers
- **Upgradeable patterns**: Support for proxy contracts
- **Test deployment**: Always deploy to testnet first

## Pre-Deployment Security Checks

⚠️ **CRITICAL**: Before ANY deployment, run these mandatory checks:

1. **Contract Analysis** (using ContractAnalyzer subagent):
   - Compile contract and analyze bytecode
   - Check for common vulnerabilities
   - Scan for dangerous opcodes (SELFDESTRUCT, DELEGATECALL)
   - Verify access control patterns

2. **Gas Estimation** (using GasOptimizer subagent):
   - Estimate deployment cost
   - Warn if cost exceeds threshold (0.1 ETH equivalent)
   - Suggest gas optimization strategies

3. **Network Validation**:
   - Confirm target network (NEVER deploy to mainnet first)
   - Verify RPC endpoint connectivity
   - Check deployer wallet has sufficient balance

4. **Code Review Checklist**:
   - ✓ No hardcoded addresses (except known constants)
   - ✓ Constructor parameters validated
   - ✓ Proper access control (Ownable, AccessControl)
   - ✓ ReentrancyGuard on payable/external functions
   - ✓ No floating pragma (use specific version)
   - ✓ Events emitted for state changes

## Deployment Workflow

### Phase 1: Preparation

1. **Read contract file**:
   ```bash
   # Find .sol files
   find . -name "*.sol" -not -path "*/node_modules/*"
   ```

2. **Read contract source**:
   ```typescript
   const source = await readFile(contractPath);
   ```

3. **Detect contract type**:
   - ERC20 token
   - ERC721/1155 NFT
   - DeFi protocol (DEX, Lending, etc.)
   - Custom logic

4. **Validate dependencies**:
   - Check for OpenZeppelin imports
   - Verify all imports exist
   - Ensure Solidity version compatibility

### Phase 2: Compilation

5. **Compile with Hardhat**:
   ```bash
   pnpm hardhat compile
   ```

6. **Check compilation**:
   - Verify artifacts created in `artifacts/`
   - Extract ABI and bytecode
   - Note contract size (max 24KB for Ethereum)

7. **Warn if oversized**:
   ```
   ⚠️ Contract size: 26.5 KB (exceeds 24KB limit)
   Suggestions:
   - Enable optimizer with higher runs
   - Split into multiple contracts
   - Use libraries for shared code
   ```

### Phase 3: Security Analysis

8. **Run ContractAnalyzer**:
   ```typescript
   const analyzer = new ContractAnalyzer({
     deepAnalysis: true,
     sourcifyEnabled: true,
   });

   const result = await analyzer.analyzeContract(
     contractAddress, // temp address
     'ethereum',
     { bytecode, abi, sourceCode }
   );
   ```

9. **Review findings**:
   - CRITICAL → Stop deployment, fix issues
   - HIGH → Warn user, require confirmation
   - MEDIUM/LOW → Display warnings, allow proceed

10. **Generate security report**:
    ```
    ╔══════════════════════════════════════╗
    ║  Security Analysis Report            ║
    ╚══════════════════════════════════════╝

    Contract: MyToken.sol
    Risk Level: LOW ✓

    Findings:
    ✓ No critical vulnerabilities
    ⚠ 2 medium severity issues:
      - Payable function without access control (L45)
      - Missing event emission (L78)

    Recommendations:
    - Add onlyOwner modifier to withdrawFunds()
    - Emit Transfer event after balance update

    Proceed with deployment? [y/N]
    ```

### Phase 4: Gas Optimization

11. **Estimate gas cost**:
    ```typescript
    const gasOptimizer = new GasOptimizer();
    const gasPrice = await gasOptimizer.optimizeGas('ethereum', 'standard');

    // Estimate deployment cost
    const deploymentGas = 2500000; // estimated
    const cost = deploymentGas * gasPrice.maxFee;
    ```

12. **Display cost estimate**:
    ```
    Deployment Cost Estimate:
    Gas Limit:     2,500,000
    Gas Price:     30 gwei (standard)
    Total Cost:    0.075 ETH (~$187.50)

    Network:       Sepolia Testnet
    Deployer:      0x742d...f0bEb
    Balance:       0.5 ETH ✓
    ```

### Phase 5: Testnet Deployment

13. **Deploy to testnet FIRST** (MANDATORY):
    ```typescript
    // Deploy to Sepolia/Goerli (Ethereum) or Devnet (Solana)
    const factory = new ethers.ContractFactory(abi, bytecode, signer);

    console.log('Deploying to Sepolia testnet...');
    const contract = await factory.deploy(
      ...constructorArgs,
      {
        gasLimit: estimatedGas * 1.2, // 20% buffer
        maxFeePerGas: gasPrice.maxFee,
        maxPriorityFeePerGas: gasPrice.priorityFee,
      }
    );

    console.log('Waiting for deployment...');
    await contract.waitForDeployment();
    ```

14. **Verify deployment**:
    ```typescript
    const address = await contract.getAddress();
    console.log(`Contract deployed at: ${address}`);

    // Wait for block confirmations
    await contract.deploymentTransaction().wait(6);
    ```

15. **Test deployed contract**:
    ```typescript
    // Run smoke tests
    if (isERC20) {
      const name = await contract.name();
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      console.log(`Token: ${name} (${symbol}), Decimals: ${decimals}`);
    }
    ```

16. **Verify on Etherscan**:
    ```bash
    pnpm hardhat verify --network sepolia ${address} ${constructorArgs}
    ```

### Phase 6: Mainnet Deployment (Only After Testnet Success)

17. **Confirmation checklist**:
    ```
    ╔══════════════════════════════════════════════════════╗
    ║  MAINNET DEPLOYMENT CHECKLIST                        ║
    ╚══════════════════════════════════════════════════════╝

    Pre-deployment verification:
    ✓ Contract tested on testnet
    ✓ Security audit passed (no critical issues)
    ✓ Gas optimization completed
    ✓ Constructor arguments verified
    ✓ Deployer wallet secured (hardware wallet recommended)
    ✓ Sufficient ETH for deployment + buffer
    ✓ Backup of contract source code

    ⚠️  MAINNET DEPLOYMENT IS PERMANENT AND IRREVERSIBLE

    Type "I UNDERSTAND THE RISKS" to proceed:
    ```

18. **Deploy to mainnet** (if confirmed):
    - Same process as testnet but with mainnet network
    - Use higher gas for faster confirmation
    - Monitor transaction closely

19. **Post-deployment**:
    - Verify on Etherscan
    - Transfer ownership (if applicable)
    - Renounce ownership or set up multi-sig (if appropriate)
    - Document deployment addresses

## Examples

### Example 1: Deploy ERC20 Token

**User Input:**
```
Deploy this token contract to Sepolia: contracts/MyToken.sol
Constructor args: name="MyToken", symbol="MTK", supply=1000000
```

**Skill Actions:**

1. Read contract file:
   ```typescript
   const source = await readFile('contracts/MyToken.sol');
   ```

2. Compile:
   ```bash
   pnpm hardhat compile
   ```

3. Run security check:
   ```typescript
   const analyzer = new ContractAnalyzer();
   const result = await analyzer.analyzeContract(...);
   // Risk: LOW ✓
   ```

4. Estimate gas:
   ```
   Deployment Cost: 0.023 ETH (~$57.50)
   ```

5. Deploy to Sepolia:
   ```typescript
   const token = await ethers.deployContract('MyToken', [
     'MyToken',
     'MTK',
     ethers.parseUnits('1000000', 18)
   ]);
   await token.waitForDeployment();
   ```

6. Output:
   ```
   ✓ Contract deployed successfully!

   Network:     Sepolia Testnet
   Address:     0x1234...5678
   TX Hash:     0xabcd...ef00
   Gas Used:    1,234,567
   Total Cost:  0.023 ETH

   Verification in progress...
   ✓ Verified on Sepolia Etherscan

   View at: https://sepolia.etherscan.io/address/0x1234...5678
   ```

### Example 2: Deploy with Proxy Pattern

**User Input:**
```
Deploy upgradeable ERC20 using UUPS proxy
```

**Skill Actions:**

1. Check for proxy contracts:
   ```typescript
   // Look for hardhat-upgrades
   const hasUpgrades = await checkDependency('@openzeppelin/hardhat-upgrades');
   ```

2. Deploy implementation + proxy:
   ```typescript
   const { deployProxy } = require('@openzeppelin/hardhat-upgrades');

   const Token = await ethers.getContractFactory('MyUpgradeableToken');
   const proxy = await deployProxy(Token, [name, symbol], {
     initializer: 'initialize',
     kind: 'uups',
   });
   ```

3. Output addresses:
   ```
   ✓ Upgradeable contract deployed!

   Implementation: 0x1111...2222
   Proxy:          0x3333...4444 (USE THIS ADDRESS)
   Admin:          0x5555...6666
   ```

### Example 3: Deploy Solana Program

**User Input:**
```
Deploy my Solana program to devnet: programs/my_program/src/lib.rs
```

**Skill Actions:**

1. Build Solana program:
   ```bash
   cd programs/my_program
   cargo build-bpf
   ```

2. Deploy to devnet:
   ```bash
   solana program deploy \
     target/deploy/my_program.so \
     --url devnet \
     --keypair ~/.config/solana/id.json
   ```

3. Output:
   ```
   ✓ Program deployed successfully!

   Network:     Solana Devnet
   Program ID:  EkSnNW...PTKN1N
   TX:          5vK9j...8dQp
   Cost:        0.5 SOL

   Verify: solana program show EkSnNW...PTKN1N --url devnet
   ```

## Implementation Notes

### Required Files

1. **Subagents**:
   - `src/subagents/ContractAnalyzer.ts` - Security analysis
   - `src/subagents/GasOptimizer.ts` - Gas estimation
   - `src/subagents/TransactionBuilder.ts` - Build deploy TX

2. **MCP Servers**:
   - `src/mcp-servers/ethereum/tools.ts` - Deploy tool
   - `src/mcp-servers/solana/tools.ts` - Solana deploy

3. **Configuration**:
   - `hardhat.config.ts` - Network configs
   - `.env` - Private keys (TESTNET ONLY)

### Safety Rules

⚠️ **NEVER:**
- Deploy to mainnet without testnet verification
- Deploy contracts with critical security issues
- Use production private keys in code
- Hardcode sensitive data in contracts
- Deploy without sufficient gas buffer

✓ **ALWAYS:**
- Run security analysis first
- Deploy to testnet before mainnet
- Verify contracts on block explorers
- Use hardware wallets for mainnet
- Keep backup of source code
- Document constructor arguments
- Test thoroughly after deployment

### Error Handling

Common deployment errors and solutions:

1. **"Insufficient funds"**:
   - Check wallet balance
   - Account for gas + deployment cost
   - Get testnet ETH from faucet

2. **"Contract code size exceeds limit"**:
   - Enable optimizer: `optimizer: { enabled: true, runs: 200 }`
   - Split into multiple contracts
   - Use libraries

3. **"Nonce too low"**:
   - Use NonceManager subagent
   - Reset nonce if needed

4. **"Transaction underpriced"**:
   - Increase gas price
   - Use GasOptimizer with 'fast' strategy

5. **"Verification failed"**:
   - Check constructor args match
   - Ensure compiler version matches
   - Verify optimizer settings match

## Output Format

```
╔════════════════════════════════════════════════════╗
║  Smart Contract Deployment                         ║
╚════════════════════════════════════════════════════╝

Phase 1: Security Analysis
✓ No critical vulnerabilities found
⚠ 1 medium severity issue (addressed)

Phase 2: Gas Optimization
Gas Estimate: 2,500,000
Cost: 0.075 ETH (~$187.50)
Strategy: Standard (3 min confirmation)

Phase 3: Testnet Deployment
Network: Sepolia
Deploying... [████████████████] 100%
✓ Deployed at: 0x1234...5678
✓ Verified on Etherscan

Phase 4: Testing
✓ Contract responds correctly
✓ All functions accessible
✓ State properly initialized

╔════════════════════════════════════════════════════╗
║  Deployment Successful                             ║
╚════════════════════════════════════════════════════╝

Contract Address: 0x1234567890123456789012345678901234567890
Transaction Hash: 0xabcd...ef00
Block Number:     #18,234,567
Gas Used:         2,345,678
Total Cost:       0.070425 ETH ($176.06)

View on Etherscan:
https://sepolia.etherscan.io/address/0x1234...5678

Next Steps:
→ Test contract functions
→ Consider mainnet deployment
→ Set up monitoring/alerts
```

## Related Skills

- Use `security-audit` for detailed security analysis
- Use `blockchain-query` to verify deployment
- Use `wallet-manager` for secure key management

## Success Criteria

✓ Security analysis passed
✓ Contract compiled without errors
✓ Deployed to testnet successfully
✓ Verified on block explorer
✓ Post-deployment tests passed
✓ Deployment documented
