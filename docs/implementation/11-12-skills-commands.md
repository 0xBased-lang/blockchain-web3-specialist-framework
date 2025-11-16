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
allowed-tools: ["Bash", "Read", "Grep"]
argument-hint: "address, transaction hash, or query"
model: haiku
---

# Blockchain Query Skill

## Activation Triggers

Activate this skill when the user:
- Provides an address (0x... for Ethereum, Base58 for Solana)
- Provides a transaction hash (0x... followed by 64 hex chars)
- Asks about balances, transactions, or contracts
- Uses keywords: "balance", "transaction", "wallet", "contract", "address"

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

---

**contract-deploy** (`.claude/skills/contract-deploy/SKILL.md`)

```markdown
---
name: contract-deploy
description: Compile, deploy, and verify smart contracts on Ethereum and compatible chains
allowed-tools: ["Bash", "Read", "Write", "Grep"]
argument-hint: "contract path and network"
model: sonnet
---

## Activation Triggers
- User mentions "deploy contract", "deploy to", "compile and deploy"
- User provides .sol file path
- Keywords: "deploy", "contract", "hardhat", "verify"

## Capabilities
- Compile Solidity contracts with Hardhat
- Deploy with constructor arguments
- Verify on block explorers (Etherscan, etc.)
- Includes templates for ERC20, ERC721, ERC1155
```

---

**wallet-manager** (`.claude/skills/wallet-manager/SKILL.md`)

```markdown
---
name: wallet-manager
description: Securely manage wallets, private keys, and signing operations
allowed-tools: ["Bash", "Read", "Write"]
argument-hint: "wallet operation (generate/import/sign/export)"
model: sonnet
---

## Activation Triggers
- User mentions "wallet", "private key", "sign transaction"
- Keywords: "generate wallet", "import key", "sign message"

## Capabilities
- Generate new wallets (HD or standalone)
- Import existing (always encrypted)
- Sign messages/transactions
- Export (encrypted only, NEVER plaintext)

## Security
- 100% test coverage required
- Keys ALWAYS encrypted (AES-256-GCM)
- Keys wiped from memory after use
```

---

**defi-swap** (`.claude/skills/defi-swap/SKILL.md`)

```markdown
---
name: defi-swap
description: Execute optimal token swaps across DEX aggregators
allowed-tools: ["Bash", "Read"]
argument-hint: "swap parameters (amount, from, to)"
model: sonnet
---

## Activation Triggers
- User mentions "swap", "trade", "exchange tokens"
- Keywords: "swap", "uniswap", "dex", "trade"

## Capabilities
- Get quotes from DEXes (Uniswap V3, Sushiswap, 1inch, Paraswap)
- Calculate slippage and price impact
- Execute optimal swap route
- Monitor transaction status
```

---

**nft-mint** (`.claude/skills/nft-mint/SKILL.md`)

```markdown
---
name: nft-mint
description: Deploy NFT contracts and mint tokens with IPFS metadata
allowed-tools: ["Bash", "Read", "Write"]
argument-hint: "NFT operation (deploy/mint/upload)"
model: sonnet
---

## Activation Triggers
- User mentions "NFT", "mint", "ERC721", "ERC1155"
- Keywords: "nft", "mint", "ipfs", "metadata"

## Capabilities
- Upload metadata to IPFS
- Deploy NFT contract (ERC721/1155)
- Mint single or batch tokens
- Set royalties (EIP-2981)
- Lazy minting support
```

---

**security-audit** (`.claude/skills/security-audit/SKILL.md`)

```markdown
---
name: security-audit
description: Analyze smart contracts for security vulnerabilities and gas optimization
allowed-tools: ["Bash", "Read", "Write", "Grep"]
argument-hint: "contract path or address"
model: sonnet
---

## Activation Triggers
- User mentions "audit", "security", "vulnerabilities"
- User provides contract for review
- Keywords: "audit", "security", "slither", "vulnerabilities", "optimize gas"

## Capabilities
- Run Slither static analysis
- Check common vulnerabilities (reentrancy, overflow, etc.)
- Gas optimization suggestions
- Generate severity-rated report
```

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
arguments: $1 (transaction hash), $2 (network, default: sepolia)
allowed-tools: ["Bash", "Read", "Grep"]
model: sonnet
---

Debug transaction $1 on ${2:-sepolia} network.

## Context

Transaction debugging requires:
- Read tool for viewing transaction details
- Bash for running blockchain queries
- Grep for finding related code

## Steps

1. Validate transaction hash format (0x followed by 64 hex characters)
2. Query via MCP server: `query_transaction $1`
3. If failed:
   - Decode revert reason from transaction receipt
   - Analyze gas usage vs gas limit (did it run out?)
   - Check common issues:
     * Insufficient balance
     * Slippage too low (for swaps)
     * Missing token approval
     * Contract error
     * Nonce collision
4. Provide specific fix suggestions with exact commands

## Output Format

```
🔍 Transaction Analysis: $1
Network: ${2:-sepolia}

Status: [SUCCESS/FAILED]
Gas Used: X / Y (Z%)

[If failed]
⚠️ Revert Reason: "..."

💡 Fix: [Specific actionable steps]
```

## Example Output

```
🔍 Transaction Analysis: 0xabc...def
Network: sepolia

Status: ❌ FAILED
Gas Used: 21,000 / 100,000 (21%)
Revert Reason: "TransferHelper: TRANSFER_FROM_FAILED"

Problem: Token approval missing
💡 Fix: You need to approve the contract to spend your tokens first:
  1. Call approve() on token contract (0x456...)
  2. Set spender to: 0x789...
  3. Set amount to: 1000000000000000000 (or use max: 2^256-1)

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
allowed-tools: ["Bash", "Read", "Write", "Grep"]
model: sonnet
---

Deploy contract at $1 to ${2:-sepolia} network.

## Context

Contract deployment requires:
- Read tool to verify contract code
- Bash to run Hardhat commands
- Write tool to save deployment info
- Grep to find contract dependencies

## Steps

1. Verify contract exists at path $1
2. Read and validate contract code
3. Compile with Hardhat
   ```bash
   npx hardhat compile
   ```
4. Run tests (MUST pass before deployment)
   ```bash
   npx hardhat test
   ```
5. Estimate deployment gas
6. Get current gas price for ${2:-sepolia}
7. Calculate total cost and confirm with user
8. Deploy contract with proper gas settings
9. Wait for confirmation (12+ blocks on mainnet)
10. Verify on block explorer
    ```bash
    npx hardhat verify --network ${2:-sepolia} <address> <args>
    ```
11. Save deployment info to `deployments/${2:-sepolia}.json`

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

**/query** - Quick blockchain queries

Create `.claude/commands/query.md`:

```markdown
---
description: Query blockchain data quickly using natural language
arguments: $ARGUMENTS (natural language query)
allowed-tools: ["Bash", "Read"]
model: haiku
---

Query: $ARGUMENTS

## Context

Quick blockchain queries for common operations:
- Balance queries (native + tokens)
- Transaction lookups
- Block information
- Contract data
- Gas prices
- Account information

## Steps

1. Parse natural language query
2. Identify query type (balance/tx/block/contract/gas)
3. Extract parameters (address, tx hash, block number, etc.)
4. Route to appropriate MCP tool
5. Format and display results

## Supported Query Types

- "What's the balance of 0x123..."
- "Show me transaction 0xabc..."
- "Get gas price on Ethereum"
- "Block 12345678 details"
- "Contract at 0x456... info"

## Output Format

Concise, human-readable format with relevant details only.
```

**/analyze** - Smart contract security analysis

Create `.claude/commands/analyze.md`:

```markdown
---
description: Analyze smart contract for security vulnerabilities
arguments: $1 (contract path or address), $2 (depth: quick|full, default: quick)
allowed-tools: ["Bash", "Read", "Grep", "Write"]
model: sonnet
---

Analyze $1 for security vulnerabilities (${2:-quick} mode).

## Context

Security analysis uses multiple tools:
- Slither for static analysis
- Custom vulnerability checks
- Gas optimization suggestions
- Best practice validation

## Steps

1. Identify if $1 is path or address
2. If address: fetch bytecode from blockchain
3. If path: read contract source code
4. Run Slither analysis
   ```bash
   slither $1 --json slither-report.json
   ```
5. Parse Slither output for vulnerabilities
6. Run custom security checks:
   - Reentrancy patterns
   - Integer overflow/underflow
   - Unchecked external calls
   - tx.origin authentication
   - Delegatecall to untrusted callee
   - Timestamp dependencies
7. Check for common best practices
8. Generate severity-rated report

## Analysis Modes

- **quick**: Slither + critical checks only (2-3 min)
- **full**: Slither + all custom checks + gas optimization (10-15 min)

## Output Format

```
🔒 Security Analysis: $1
Mode: ${2:-quick}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Risk Level: [LOW/MEDIUM/HIGH/CRITICAL]
Issues Found: X critical, Y high, Z medium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[List of critical issues with line numbers and fixes]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Actionable fixes prioritized by severity]
```

Full report saved to: security-analysis-[timestamp].md
```

**/swap** - Token swaps

Create `.claude/commands/swap.md`:

```markdown
---
description: Execute token swaps on DEXes with optimal routing
arguments: $1 (amount), $2 (from token), $3 (to token), $4 (slippage %, default: 0.5)
allowed-tools: ["Bash", "Read"]
model: sonnet
---

Swap $1 $2 for $3 with ${4:-0.5}% slippage tolerance.

## Context

Token swaps compare multiple DEX aggregators:
- Uniswap V3 (direct pools)
- Sushiswap
- 1inch aggregator
- Paraswap

## Steps

1. Validate token addresses (or resolve from symbol)
2. Get quotes from all DEX sources in parallel
3. Calculate for each quote:
   - Expected output amount
   - Price impact
   - Gas cost estimate
   - Total effective price (including gas)
4. Display comparison table
5. Recommend best option (highest output - gas cost)
6. Ask for user confirmation
7. If confirmed:
   - Check token approval
   - Execute swap with ${4:-0.5}% slippage protection
   - Monitor transaction
   - Display final result

## Safety Checks

- Price impact > 5%: Warn user
- Price impact > 15%: Require explicit confirmation
- Slippage > 2%: Warn about MEV risk
- Gas > 500 gwei: Warn about high gas

## Output Format

```
💱 Swap Quote: $1 $2 → $3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEX         Output      Gas      Total   Impact
────────────────────────────────────────────────
1inch       1,234.56    0.015    1,234.54   0.3%
Uniswap V3  1,232.10    0.008    1,232.09   0.4%
Sushiswap   1,228.45    0.012    1,228.44   0.5%

🏆 Best: 1inch (highest net output)

Price Impact: 0.3% ✅
Slippage: ${4:-0.5}%
Estimated Gas: 0.015 ETH ($37.50)

Proceed? [y/n]
```
```

**/status** - System status

Create `.claude/commands/status.md`:

```markdown
---
description: Show framework status and health metrics
arguments: $1 (detail level: basic|full, default: basic)
allowed-tools: ["Bash", "Read", "Grep"]
model: haiku
---

Show framework status (${1:-basic} mode).

## Context

System health monitoring includes:
- MCP servers connectivity
- Agent status
- Blockchain network connectivity
- Recent errors/warnings
- Performance metrics

## Steps

1. Check MCP server status
   - Ethereum MCP (port 3000)
   - Solana MCP (port 3001)
   - Multi-chain MCP (port 3002)
2. Test agent responsiveness
   - Orchestrator
   - DeFi, NFT, Analytics agents
3. Check blockchain connectivity
   - Ethereum RPC (latest block number)
   - Solana RPC (latest slot)
4. Query recent logs for errors
5. If full mode: show performance metrics
   - Average response time
   - Cache hit rate
   - API rate limit usage

## Output Format

```
🔧 Framework Status
Time: [timestamp]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MCP SERVERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Ethereum MCP       (port 3000, 45ms)
✅ Solana MCP         (port 3001, 38ms)
⚠️  Multi-chain MCP   (port 3002, SLOW 1200ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Orchestrator       (healthy)
✅ DeFi Agent         (healthy)
✅ NFT Agent          (healthy)
✅ Analytics Agent    (healthy)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLOCKCHAIN CONNECTIVITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Ethereum           (block 18,234,567)
✅ Solana             (slot 245,678,901)
✅ Polygon            (block 51,234,890)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECENT ISSUES (last 24h)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  2 rate limit warnings (Ethereum RPC)
ℹ️  1 cache miss (Solana token metadata)

Overall Health: 🟢 HEALTHY
```

[If full mode: additional performance metrics]
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