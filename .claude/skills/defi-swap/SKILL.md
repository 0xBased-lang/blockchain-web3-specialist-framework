---
name: defi-swap
description: Execute token swaps on DEX protocols (Uniswap, Sushiswap, PancakeSwap, Jupiter) with price optimization and slippage protection
allowed-tools: ["Bash", "Read", "Grep"]
argument-hint: "swap details (from token, to token, amount)"
model: sonnet
---

# DeFi Swap Skill

## Activation Triggers

Activate when user:
- Wants to swap/exchange tokens
- Mentions DEX names (Uniswap, Sushiswap, etc.)
- Uses keywords: "swap", "exchange", "trade", "buy tokens"
- Provides token pairs (ETH→USDC, SOL→USDT)
- Asks about swap quotes/prices

## Capabilities

- Multi-DEX support (Uniswap V2/V3, Sushiswap, Curve, Jupiter)
- Best price routing across multiple DEXs
- Slippage protection (default 0.5%, max 5%)
- MEV protection (Flashbots integration)
- Gas optimization
- Price impact warnings
- Sandwich attack protection

## Swap Workflow

### 1. Get Quote

**User**: "Swap 1 ETH for USDC"

**Actions**:
```typescript
import { PriceOracle } from './src/subagents/PriceOracle';

// Get best quote across DEXs
const oracle = new PriceOracle();
const quote = await oracle.getSwapQuote({
  fromToken: 'ETH',
  toToken: 'USDC',
  amount: '1.0',
  chain: 'ethereum',
});
```

**Output**:
```
╔═══════════════════════════════════════════════════╗
║  Swap Quote                                       ║
╚═══════════════════════════════════════════════════╝

Swap: 1.00 ETH → USDC
Best Route: Uniswap V3 (0.05% pool)

You Will Receive: ~2,485.32 USDC
Price: 1 ETH = 2,485.32 USDC
Price Impact: 0.12% ✓
Slippage Tolerance: 0.5%
Minimum Received: 2,472.92 USDC

Gas Estimate: 150,000 gas (~0.0045 ETH / $11.19)

⚠️  Price expires in 30 seconds

Execute swap? [y/N]:
```

### 2. Compare Routes

**User**: "Show me all swap routes"

**Output**:
```
Available Swap Routes for 1 ETH → USDC:

1. Uniswap V3 (0.05% pool)
   Output: 2,485.32 USDC ✓ BEST
   Gas: 150,000

2. Uniswap V2
   Output: 2,483.15 USDC
   Gas: 120,000

3. Sushiswap
   Output: 2,480.67 USDC
   Gas: 125,000

4. Curve (via WETH)
   Output: 2,478.90 USDC
   Gas: 180,000

Recommendation: Use Uniswap V3 for best output
```

### 3. Execute Swap

**Actions**:
```typescript
import { TransactionBuilder } from './src/subagents/TransactionBuilder';
import { TransactionSimulator } from './src/subagents/TransactionSimulator';

// Build swap transaction
const swapTx = await buildSwapTransaction({
  dex: 'uniswap-v3',
  fromToken: 'ETH',
  toToken: 'USDC',
  amountIn: ethers.parseEther('1.0'),
  slippage: 0.005, // 0.5%
  recipient: wallet.address,
});

// Simulate before executing
const simulation = await simulator.simulate(swapTx);

if (simulation.riskLevel === 'high' || simulation.riskLevel === 'critical') {
  console.log('⚠️ RISK DETECTED:', simulation.risks);
  // Require user confirmation
}

// Execute
const tx = await wallet.sendTransaction(swapTx);
```

## Safety Features

### Price Impact Warnings

```typescript
if (priceImpact > 0.05) { // > 5%
  console.warn(`
    ⚠️  HIGH PRICE IMPACT: ${(priceImpact * 100).toFixed(2)}%

    This trade will significantly move the market price.
    Consider:
    - Splitting into smaller trades
    - Using a different DEX with deeper liquidity
    - Waiting for better market conditions
  `);
}
```

### Slippage Protection

```typescript
const minAmountOut = expectedAmount * (1 - slippageTolerance);

// In smart contract call:
router.swapExactTokensForTokens(
  amountIn,
  minAmountOut, // Revert if less than this
  path,
  recipient,
  deadline
);
```

### MEV Protection

```typescript
// Use Flashbots RPC for Ethereum mainnet
if (network === 'mainnet') {
  const flashbotsProvider = new FlashbotsBundleProvider(
    provider,
    flashbotsSigner
  );

  // Send transaction privately
  await flashbotsProvider.sendPrivateTransaction({
    transaction: swapTx,
    maxBlockNumber: currentBlock + 5,
  });
}
```

## Examples

### Example 1: Simple Swap

**User**: "Swap 100 USDC for DAI"

1. Check token addresses
2. Get quote
3. Show price + gas
4. Simulate transaction
5. Execute if approved
6. Monitor transaction
7. Confirm completion

### Example 2: Multi-Hop Swap

**User**: "Swap SHIB for LINK"

**Route**: SHIB → WETH → LINK (two hops)

```
Route: SHIB → WETH → LINK

Step 1: SHIB → WETH
  Pool: Uniswap V2
  Input: 1,000,000 SHIB
  Output: ~0.0125 WETH

Step 2: WETH → LINK
  Pool: Uniswap V3 (0.3%)
  Input: 0.0125 WETH
  Output: ~1.85 LINK

Total: 1,000,000 SHIB → 1.85 LINK
Price Impact: 0.8%
Gas: ~220,000 (two swaps)
```

### Example 3: Solana Swap (Jupiter)

**User**: "Swap 10 SOL for USDC on Solana"

```typescript
// Jupiter aggregator for Solana
const jupiterQuote = await fetch('https://quote-api.jup.ag/v6/quote', {
  params: {
    inputMint: 'So11111111111111111111111111111111111111112', // SOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount: 10_000_000_000, // 10 SOL in lamports
    slippageBps: 50, // 0.5%
  }
});
```

## Implementation Notes

### Required Files

- `src/subagents/PriceOracle.ts` - Price quotes
- `src/subagents/TransactionBuilder.ts` - Build swap TX
- `src/subagents/TransactionSimulator.ts` - Simulate swaps
- `src/types/oracle.ts` - Oracle types

### DEX Interfaces

```typescript
// Uniswap V2 Router
interface IUniswapV2Router {
  swapExactTokensForTokens(
    amountIn: bigint,
    amountOutMin: bigint,
    path: string[],
    to: string,
    deadline: number
  ): Promise<bigint[]>;
}

// Uniswap V3 Router
interface ISwapRouter {
  exactInputSingle(params: {
    tokenIn: string;
    tokenOut: string;
    fee: number;
    recipient: string;
    deadline: number;
    amountIn: bigint;
    amountOutMinimum: bigint;
    sqrtPriceLimitX96: bigint;
  }): Promise<bigint>;
}
```

## Related Skills

- Use `blockchain-query` to check token balances
- Use `wallet-manager` to sign swap transactions
- Use `security-audit` to verify DEX contracts
- Use `nft-mint` for NFT marketplace swaps
