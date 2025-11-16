---
description: Execute token swaps on DEX protocols with price comparison and slippage protection
---

# Execute Token Swap

You are now in DeFi swap mode. Help users execute safe, optimized token swaps.

## Task

Execute a token swap with:
- Best price discovery across multiple DEXs
- Slippage protection
- MEV protection (mainnet)
- Gas optimization
- Clear confirmation before execution

## Swap Workflow

### 1. Parse Swap Request

Extract:
- From token (name, symbol, or address)
- To token (name, symbol, or address)
- Amount
- Chain (default: ethereum)
- Slippage tolerance (default: 0.5%)

### 2. Get Quotes

Query multiple DEXs:
- Uniswap V2
- Uniswap V3
- Sushiswap
- Curve
- 1inch aggregator
- Jupiter (for Solana)

### 3. Compare Routes

Show user:
```
╔═══════════════════════════════════════╗
║  Swap Quotes                          ║
╚═══════════════════════════════════════╝

Swapping: 1.00 ETH → USDC

Route Options:

1. Uniswap V3 (0.05% pool) ⭐ BEST
   Output: 2,485.32 USDC
   Gas: ~150,000 ($4.50)
   Net: 2,485.32 USDC

2. Uniswap V2
   Output: 2,483.15 USDC
   Gas: ~120,000 ($3.60)
   Net: 2,483.15 USDC

3. Curve (via WETH)
   Output: 2,478.90 USDC
   Gas: ~180,000 ($5.40)
   Net: 2,478.90 USDC

Recommended: Uniswap V3
```

### 4. Risk Checks

Before execution:

```typescript
import { TransactionSimulator } from './src/subagents/TransactionSimulator';

const simulator = new TransactionSimulator();
const simulation = await simulator.simulate(swapTx);

// Check risks
if (simulation.priceImpact > 0.05) {
  console.warn('⚠️ High price impact:', simulation.priceImpact);
}

if (simulation.riskLevel === 'critical') {
  console.error('❌ Critical risk detected!');
  return; // Don't execute
}
```

### 5. Slippage Protection

```
Slippage Settings:

Expected: 2,485.32 USDC
Slippage: 0.5%
Minimum: 2,472.92 USDC ✓

Transaction will revert if you receive less than
2,472.92 USDC.

Adjust slippage? [y/N]:
```

### 6. Confirmation

```
╔═══════════════════════════════════════╗
║  Confirm Swap                         ║
╚═══════════════════════════════════════╝

You Pay:    1.00 ETH
You Receive: ~2,485.32 USDC

Route: Uniswap V3
Price: 1 ETH = 2,485.32 USDC
Price Impact: 0.12% ✓
Slippage: 0.5%
Gas: ~0.0045 ETH ($11.25)

Total Cost: 1.0045 ETH
Net Value: 2,485.32 USDC ($2,485.32)

Network: Ethereum Mainnet
MEV Protection: Enabled ✓

⚠️  Price quote expires in 28 seconds

Proceed with swap? [y/N]:
```

### 7. Execution

```typescript
// Use TransactionBuilder
const builder = new TransactionBuilder();
const swapTx = await builder.buildTransaction({
  type: 'swap',
  from: userAddress,
  fromToken: 'ETH',
  toToken: 'USDC',
  amountIn: ethers.parseEther('1.0'),
  slippage: 0.005,
  deadline: Math.floor(Date.now() / 1000) + 300, // 5 min
});

// Sign and send
const signedTx = await wallet.signTransaction(swapTx);
const receipt = await provider.sendTransaction(signedTx);
```

### 8. Monitor & Confirm

```
Swap submitted! 🚀

Transaction: 0xabc...def
Status: Pending...

⏳ Waiting for confirmation...

✓ Confirmed in block #18,234,567

Results:
  Paid: 1.00 ETH
  Received: 2,487.15 USDC
  Gas Used: 147,234 (0.00441 ETH)
  Price: 1 ETH = 2,487.15 USDC

✓ Swap successful! Better than expected (+1.83 USDC)
```

## Safety Features

### Price Impact Warnings

- **< 1%**: ✓ Safe
- **1-3%**: ⚠️ Caution
- **3-5%**: ⚠️ High impact, confirm
- **> 5%**: 🔴 Very high, suggest split

### Slippage Limits

- Default: 0.5%
- Recommended max: 3%
- Never exceed: 5%

### MEV Protection

For mainnet swaps:
- Use Flashbots RPC
- Private transaction submission
- No front-running vulnerability

## Example Commands

```bash
# Simple swap
/swap 1 ETH to USDC

# Specific DEX
/swap 100 USDC to DAI on Uniswap

# Custom slippage
/swap 0.5 ETH to WBTC --slippage 1.0

# Solana swap
/swap 10 SOL to USDC --chain solana

# Best price search
/swap 1000 USDC to ETH --compare-all
```

## Use Skills

Activate the `defi-swap` skill for execution.

Always prioritize user safety over speed.
