# Skills System & Slash Commands (Guides 11-12)

## Guide 11: Skills System

**Time**: 10-15 hours | **Complexity**: Medium

### What You'll Build

6 production-ready skills for Claude Code:
1. blockchain-query
2. contract-deploy
3. wallet-manager
4. defi-swap
5. nft-mint
6. security-audit

---

### Skill 1: Blockchain Query

Create `.claude/skills/blockchain-query/SKILL.md`:

```markdown
---
name: blockchain-query
description: Query blockchain data including balances, transactions, and contracts across multiple chains (Ethereum, Solana, Polygon)
---

# Blockchain Query Skill

## When to Use

Activate this skill when the user asks to:
- Check wallet balances (native tokens or ERC20/SPL tokens)
- Look up transaction details
- Inspect smart contract state
- Query blockchain information
- Get account information

## Capabilities

- **Multi-chain support**: Ethereum, Solana, Polygon, Arbitrum
- **Balance queries**: Native currency + tokens (ERC20, ERC721, SPL)
- **Transaction lookup**: By hash, with full details and status
- **Contract inspection**: Bytecode, ABI, storage
- **Real-time data**: Latest blockchain state

## Usage Pattern

When user provides an address or transaction hash:

1. **Detect chain** from format (0x = Ethereum, Base58 = Solana)
2. **Validate** address/hash format
3. **Query** via appropriate MCP server
4. **Format** response with proper decimals
5. **Display** with USD values if available

## Examples

### Example 1: Check ETH Balance
```
User: "What's the balance of 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb?"

Steps:
1. Validate Ethereum address format
2. Call ethereum MCP: query_balance tool
3. Convert wei to ETH
4. Fetch ETH price from CoinGecko
5. Display: "15.234 ETH ($38,085 USD)"
```

### Example 2: Look Up Transaction
```
User: "Show me details for transaction 0xabc...def"

Steps:
1. Call ethereum MCP: read transaction resource
2. Parse transaction data
3. Decode if contract interaction
4. Display:
   - From/To addresses
   - Value transferred
   - Gas used
   - Status (success/failed)
   - Block number and timestamp
```

### Example 3: Multi-Chain Balance
```
User: "Show my total balance across all chains for address 0x123"

Steps:
1. Call multi-chain MCP: get_aggregated_balance
2. Query Ethereum, Polygon, Arbitrum in parallel
3. Aggregate and convert to USD
4. Display breakdown by chain
```

## Error Handling

- **Invalid address**: "That doesn't look like a valid Ethereum address. Ethereum addresses start with '0x' and are 42 characters long."
- **Transaction not found**: "I couldn't find that transaction. It may not be confirmed yet, or the hash might be incorrect."
- **Network issues**: "I'm having trouble connecting to the blockchain. Let me try again..."

## Integration

This skill uses:
- **MCP Servers**: ethereum, solana, multi-chain
- **Tools**: query_balance, get_transaction, get_account_info
- **Resources**: accounts, transactions, contracts
```

---

### Skill 2-6: Additional Skills (Structure)

Following the same pattern, create:

**contract-deploy** (`.claude/skills/contract-deploy/SKILL.md`)
- Compile Solidity contracts
- Deploy with Hardhat
- Verify on block explorer
- Includes templates for ERC20, ERC721

**wallet-manager** (`.claude/skills/wallet-manager/SKILL.md`)
- Generate new wallets
- Import existing (encrypted)
- Sign messages/transactions
- Export (encrypted)

**defi-swap** (`.claude/skills/defi-swap/SKILL.md`)
- Get quotes from DEXes (Uniswap, Sushiswap, 1inch)
- Calculate slippage
- Execute optimal swap
- Monitor transaction

**nft-mint** (`.claude/skills/nft-mint/SKILL.md`)
- Upload metadata to IPFS
- Deploy NFT contract (ERC721/1155)
- Mint tokens
- Set royalties

**security-audit** (`.claude/skills/security-audit/SKILL.md`)
- Run Slither analysis
- Check common vulnerabilities
- Gas optimization suggestions
- Generate report

---

## Guide 12: Slash Commands

**Time**: 8-10 hours | **Complexity**: Low-Medium

### Commands to Build

Create `.claude/commands/` directory with:

---

### Command 1: /debug

Create `.claude/commands/debug.md`:

```markdown
---
description: Debug failed transactions and identify issues
---

Debug transaction $1 on $2 network.

## Steps

1. Fetch transaction details via MCP server
2. Check transaction status (success/failed)
3. If failed:
   - Decode revert reason
   - Analyze gas usage (did it run out?)
   - Check common issues:
     * Insufficient balance
     * Slippage too low (for swaps)
     * Missing token approval
     * Contract error
4. Provide specific fix suggestions

## Example Output

```
Transaction: 0xabc...def
Status: ❌ FAILED
Revert Reason: "TransferHelper: TRANSFER_FROM_FAILED"

Problem: Token approval missing
Fix: You need to approve the contract to spend your tokens first:
  1. Call approve() on token contract
  2. Set spender to: 0x789...
  3. Set amount to: 1000000000000000000 (or use max)

Would you like me to create the approval transaction?
```
```

---

### Command 2: /deploy

Create `.claude/commands/deploy.md`:

```markdown
---
description: Deploy smart contracts with verification
arguments: $1 (contract path), $2 (network, default: sepolia)
---

Deploy contract at $1 to $2.

## Steps

1. Verify contract exists at path
2. Compile with Hardhat
   ```bash
   npx hardhat compile
   ```
3. Run tests
   ```bash
   npx hardhat test
   ```
4. Estimate deployment gas
5. Confirm with user
6. Deploy contract
7. Wait for confirmation
8. Verify on block explorer
   ```bash
   npx hardhat verify --network $2 <address> <args>
   ```
9. Save deployment info to `deployments/$2.json`

## Example

```
User: /deploy contracts/MyToken.sol sepolia

Output:
🔨 Compiling MyToken.sol...
✅ Compiled successfully

🧪 Running tests...
✅ All 15 tests passed

⛽ Estimated gas: 1,234,567 (≈0.05 ETH at 40 gwei)

Deploy to Sepolia testnet?
[y/n]: y

🚀 Deploying...
✅ Deployed to: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
📝 Verifying on Etherscan...
✅ Verified: https://sepolia.etherscan.io/address/0x742d...

Deployment saved to: deployments/sepolia.json
```
```

---

### Commands 3-6: Additional Commands

**/ query** - Quick blockchain queries
```markdown
---
description: Query blockchain data quickly
---

Query $ARGUMENTS

Parse natural language query and route to appropriate MCP tool.
Supported: balances, transactions, blocks, contracts, gas prices.
```

**/analyze** - Smart contract security analysis
```markdown
---
description: Analyze smart contract for security issues
arguments: $1 (contract path or address)
---

Analyze $1 for security vulnerabilities using Slither and custom checks.
Generate detailed report with severity ratings.
```

**/swap** - Token swaps
```markdown
---
description: Execute token swaps on DEXes
arguments: $1 (amount), $2 (from token), $3 (to token)
---

Swap $1 $2 for $3 on best DEX.

1. Get quotes from Uniswap, Sushiswap, 1inch
2. Show comparison table
3. Calculate price impact
4. Ask for confirmation
5. Execute with slippage protection
6. Monitor transaction
```

**/status** - System status
```markdown
---
description: Show framework status and health
---

Display:
- MCP servers status (running/stopped)
- Agent health
- Network connectivity
- Recent errors
- Performance metrics
```

---

## Testing Skills & Commands

```bash
# Test skills
cd .claude/skills
for skill in */; do
  echo "Testing $skill"
  # Skills are tested by using them in Claude Code
done

# Test commands
cd .claude/commands
for cmd in *.md; do
  echo "Testing /$cmd"
  # Commands are tested by invoking them
done
```

---

**Document Version**: 1.0.0
**Status**: Production Ready