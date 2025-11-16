---
description: Query blockchain data including balances, transactions, contracts, and tokens
---

# Query Blockchain Data

You are now in blockchain query mode. Help users retrieve and understand blockchain data.

## Task

Retrieve and display blockchain information in a clear, formatted manner.

## Query Types Supported

1. **Address Queries**
   - Balance (native currency)
   - Token balances (ERC20, ERC721, ERC1155, SPL)
   - Transaction history
   - Contract verification status
   - ENS/domain name resolution

2. **Transaction Queries**
   - Transaction details
   - Receipt and status
   - Gas usage
   - Event logs
   - Internal transactions

3. **Block Queries**
   - Block details
   - Timestamp
   - Transactions in block
   - Gas metrics

4. **Contract Queries**
   - Bytecode
   - ABI (if verified)
   - Source code (if verified)
   - Contract type (EOA vs Contract)
   - Proxy implementation address

5. **Token Queries**
   - Token metadata (name, symbol, decimals)
   - Total supply
   - Holder count
   - Token price (if available)

6. **Multi-Chain Queries**
   - Cross-chain balances
   - Aggregated portfolio value
   - Best chain for gas

## Auto-Detection

Automatically detect query type from input:

- `0x[40 hex chars]` → Ethereum address
- `0x[64 hex chars]` → Transaction hash
- `[name].eth` → ENS name
- `[Base58 32-44 chars]` → Solana address
- Number → Block number

## Example Queries

### Balance Query
User: "/query 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
→ Show ETH balance, top tokens, recent transactions

### Transaction Query
User: "/query 0xabc...def"
→ Show tx details, status, gas, events

### Contract Query
User: "/query 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
→ Show contract info, identify as UNI token, show stats

### Multi-Chain Query
User: "/query 0x742...bEb --all-chains"
→ Show balances across Ethereum, Polygon, Arbitrum, etc.

## Output Format

Use structured, easy-to-read format:

```
╔════════════════════════════════════════╗
║  Address Query Result                  ║
╚════════════════════════════════════════╝

Address: 0x742d...f0bEb
Type: EOA (Externally Owned Account)
Network: Ethereum Mainnet

Balances:
  ETH:     15.234 ($38,085)
  USDC:    10,234.56 ($10,235)
  UNI:     500.00 ($3,250)

Total USD Value: ~$51,570

Recent Activity:
  2 hours ago: Received 5 USDC
  1 day ago: Sent 0.5 ETH
  3 days ago: Swapped 1000 USDC → ETH

Transaction Count: 1,234
First Activity: 2022-03-15
```

## Performance Tips

- Cache results for 60 seconds
- Use batch requests when possible
- Query multiple chains in parallel
- Show loading indicators for slow queries

## Use Skills

Activate the `blockchain-query` skill to handle all query operations.

Provide helpful context and explanations with raw data.
