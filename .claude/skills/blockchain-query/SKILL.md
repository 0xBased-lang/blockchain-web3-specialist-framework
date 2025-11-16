---
name: blockchain-query
description: Query blockchain data including balances, transactions, and contracts across multiple chains (Ethereum, Solana, Polygon)
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
argument-hint: "address, transaction hash, or query"
model: haiku
---

# Blockchain Query Skill

## Activation Triggers

Activate this skill when the user:
- Provides an address (0x... for Ethereum, Base58 for Solana)
- Provides a transaction hash (0x... followed by 64 hex chars)
- Asks about balances, transactions, or contracts
- Uses keywords: "balance", "transaction", "wallet", "contract", "address", "query"

## When to Use

Activate this skill when the user asks to:
- Check wallet balances (native tokens or ERC20/SPL tokens)
- Look up transaction details
- Inspect smart contract state
- Query blockchain information
- Get account information
- Verify transaction status

## Capabilities

- **Multi-chain support**: Ethereum, Solana, Polygon, Arbitrum, Optimism
- **Balance queries**: Native currency + tokens (ERC20, ERC721, SPL)
- **Transaction lookup**: By hash, with full details and status
- **Contract inspection**: Bytecode, ABI, storage, events
- **Real-time data**: Latest blockchain state
- **Historical data**: Past transactions and events

## Usage Pattern

When user provides an address or transaction hash:

1. **Detect chain** from format:
   - `0x...` (40 hex chars) = Ethereum address
   - Base58 (32-44 chars) = Solana address
   - `0x...` (64 hex chars) = Transaction hash

2. **Validate** address/hash format with regex:
   - Ethereum: `/^0x[a-fA-F0-9]{40}$/`
   - Solana: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`
   - TX Hash: `/^0x[a-fA-F0-9]{64}$/`

3. **Query** via appropriate MCP server:
   - Use `src/mcp-servers/ethereum/` for Ethereum chains
   - Use `src/mcp-servers/solana/` for Solana
   - Use `src/mcp-servers/multichain/` for cross-chain queries

4. **Format** response with proper decimals:
   - Ethereum: divide by 10^18 for ETH, check token decimals for ERC20
   - Solana: divide by 10^9 for SOL

5. **Display** with USD values if available from PriceOracle

## Examples

### Example 1: Check ETH Balance

**User Input:**
```
What's the balance of 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb?
```

**Skill Actions:**
1. Detect Ethereum address format
2. Read `src/mcp-servers/ethereum/tools.ts` to understand available tools
3. Use ethers.js provider to query balance:
   ```typescript
   const balance = await provider.getBalance(address);
   const ethBalance = ethers.formatEther(balance);
   ```
4. Optionally fetch ETH price from PriceOracle subagent
5. Format response:
   ```
   Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
   Chain: Ethereum Mainnet
   Balance: 15.234 ETH
   USD Value: ~$38,085 (at $2,500/ETH)
   ```

### Example 2: Look Up Transaction

**User Input:**
```
Show me details for transaction 0xabc123...def456
```

**Skill Actions:**
1. Detect transaction hash format (64 hex chars after 0x)
2. Read `src/mcp-servers/ethereum/resources.ts` for transaction resource
3. Query transaction:
   ```typescript
   const tx = await provider.getTransaction(txHash);
   const receipt = await provider.getTransactionReceipt(txHash);
   ```
4. Parse and decode if contract interaction
5. Display formatted output:
   ```
   Transaction: 0xabc123...def456
   Status: ✓ Success
   Block: 18,234,567 (confirmed)

   From: 0x1234...5678
   To: 0xabcd...ef00
   Value: 1.5 ETH
   Gas Used: 21,000 / 21,000
   Gas Price: 25 gwei
   Total Fee: 0.000525 ETH ($1.31)

   Timestamp: 2025-11-16 14:23:45 UTC
   ```

### Example 3: Multi-Chain Balance

**User Input:**
```
Check my balance across all chains: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Skill Actions:**
1. Read `src/mcp-servers/multichain/tools.ts` for multi-chain capabilities
2. Query balance on each supported chain in parallel
3. Aggregate results:
   ```
   Multi-Chain Balance for 0x742d...f0bEb:

   Ethereum:  15.234 ETH   ($38,085)
   Polygon:    2,450 MATIC ($2,205)
   Arbitrum:   8.123 ETH   ($20,308)
   Optimism:   3.456 ETH   ($8,640)

   Total USD Value: ~$69,238
   ```

### Example 4: ERC20 Token Balance

**User Input:**
```
How much USDC does 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb hold?
```

**Skill Actions:**
1. Identify token (USDC) - known token list
2. Use ERC20 contract interface:
   ```typescript
   const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
   const contract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
   const balance = await contract.balanceOf(address);
   const decimals = await contract.decimals(); // 6 for USDC
   const formattedBalance = Number(balance) / 10**decimals;
   ```
3. Display:
   ```
   USDC Balance: 10,234.56 USDC
   Contract: 0xA0b8...eB48
   Value: ~$10,234.56 USD
   ```

### Example 5: Contract Information

**User Input:**
```
What is this contract: 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984
```

**Skill Actions:**
1. Identify as Ethereum contract address
2. Query contract data:
   ```typescript
   const code = await provider.getCode(address);
   // Check if it's ERC20/ERC721
   const isERC20 = await checkERC20Interface(address);
   ```
3. If ERC20, get name/symbol:
   ```typescript
   const name = await contract.name();
   const symbol = await contract.symbol();
   const totalSupply = await contract.totalSupply();
   ```
4. Display:
   ```
   Contract: 0x1f98...F984
   Type: ERC20 Token
   Name: Uniswap
   Symbol: UNI
   Total Supply: 1,000,000,000 UNI
   Decimals: 18
   ```

### Example 6: Solana Account

**User Input:**
```
Check SOL balance for EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N
```

**Skill Actions:**
1. Detect Solana address (Base58 format)
2. Read `src/mcp-servers/solana/tools.ts`
3. Query using Solana connection:
   ```typescript
   const balance = await connection.getBalance(publicKey);
   const solBalance = balance / 1e9; // lamports to SOL
   ```
4. Display:
   ```
   Address: EkSnNW...PTKN1N
   Chain: Solana Mainnet
   Balance: 42.567 SOL
   USD Value: ~$4,256.70 (at $100/SOL)
   ```

## Implementation Notes

### Required Files to Read

Before querying, read these files to understand the codebase:

1. **MCP Servers**:
   - `src/mcp-servers/ethereum/index.ts` - Ethereum server
   - `src/mcp-servers/ethereum/tools.ts` - Available tools
   - `src/mcp-servers/ethereum/resources.ts` - Resource types
   - `src/mcp-servers/solana/index.ts` - Solana server
   - `src/mcp-servers/multichain/index.ts` - Multi-chain aggregator

2. **Type Definitions**:
   - `src/types/index.ts` - Common types

3. **Utilities**:
   - `src/utils/logger.ts` - Logging functions

### Common Patterns

```typescript
// Pattern 1: Validate Ethereum address
function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// Pattern 2: Validate Solana address
function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

// Pattern 3: Format token balance
function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const fraction = balance % divisor;
  return `${whole}.${fraction.toString().padStart(decimals, '0')}`;
}
```

### Error Handling

Always handle these error cases:
- **Invalid address format**: "Invalid address format. Expected 0x... or Base58"
- **Network unavailable**: "Unable to connect to blockchain network"
- **Contract not found**: "No contract found at this address"
- **Transaction not found**: "Transaction not found. It may not be mined yet."
- **RPC rate limit**: "Rate limit exceeded. Please try again in a moment."

### Performance Tips

1. **Cache results**: Don't re-query the same data within 60 seconds
2. **Batch requests**: Use multicall for multiple queries
3. **Parallel queries**: Query multiple chains simultaneously
4. **Timeout**: Set 10 second timeout for RPC calls

## Output Format

Always provide structured, easy-to-read output:

```
╔════════════════════════════════════════════╗
║  Blockchain Query Result                   ║
╚════════════════════════════════════════════╝

Address: 0x742d...f0bEb
Chain:   Ethereum Mainnet
Type:    EOA (Externally Owned Account)

Balances:
  ETH:     15.234 ($38,085)
  USDC:    10,234.56 ($10,235)
  UNI:     500.00 ($3,250)

Total:     ~$51,570

Last Activity: 2 hours ago
Transaction Count: 1,234
```

## Safety Checks

⚠️ **Security Considerations**:
- Never display private keys
- Don't execute transactions (query only)
- Validate all inputs before querying
- Use read-only provider connections
- Warn if querying suspicious contracts

## Related Skills

- Use `contract-deploy` skill for deploying contracts
- Use `wallet-manager` skill for managing private keys
- Use `security-audit` skill for contract analysis
- Use `defi-swap` skill for token swaps

## Success Criteria

A successful query includes:
✓ Accurate blockchain data
✓ Proper unit formatting (wei→ETH, lamports→SOL)
✓ Clear, structured output
✓ USD values where applicable
✓ Timestamp information
✓ Error handling with helpful messages
