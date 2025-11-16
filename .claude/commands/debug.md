---
description: Debug failed transactions and identify issues with detailed error analysis
---

# Debug Transaction

You are now in debug mode for blockchain transactions.

## Task

Debug the transaction or contract issue provided by the user. Perform comprehensive analysis to identify root causes and provide actionable solutions.

## Steps

1. **Gather Information**
   - Transaction hash (if available)
   - Contract address (if applicable)
   - Expected vs actual behavior
   - Error messages or revert reasons

2. **Analyze Transaction**
   - Read transaction details from blockchain
   - Parse transaction input data
   - Check transaction receipt for errors
   - Examine event logs
   - Identify revert reason

3. **Identify Root Cause**
   - Check for common issues:
     - Insufficient gas
     - Revert with error message
     - Out of gas
     - Invalid opcode
     - Stack too deep
     - Nonce too low
     - Gas price too low
     - Slippage exceeded (for swaps)
     - Deadline expired
     - Insufficient allowance
     - Insufficient balance

4. **Provide Solution**
   - Explain what went wrong
   - Suggest specific fixes
   - Provide corrected transaction parameters if applicable
   - Show how to avoid the issue in future

## Example Debugging

If user provides: "Transaction 0xabc...def failed"

Execute:
```
1. Use blockchain-query skill to fetch transaction
2. Read transaction receipt
3. Decode revert reason
4. Analyze gas usage
5. Check contract state at time of transaction
6. Provide detailed explanation and fix
```

## Output Format

```
╔════════════════════════════════════════╗
║  Transaction Debug Report              ║
╚════════════════════════════════════════╝

Transaction: 0xabc...def
Status: ❌ Failed
Block: #18,234,567

Error: "UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT"

Root Cause:
Slippage tolerance was set to 0.5% but price moved
1.2% between quote and execution, causing the
transaction to revert.

Solution:
Increase slippage tolerance to 2% or use a more
recent price quote (< 30 seconds old).

Corrected Parameters:
- Slippage: 2.0% (was: 0.5%)
- Minimum Output: 98.5 USDC (was: 99.2 USDC)
- Deadline: Now + 5 minutes

Retry with: pnpm run swap --slippage 2.0
```

## Tools Available

- Read transaction data from blockchain
- Decode contract ABIs
- Parse error messages
- Analyze gas usage
- Check contract code
- Review transaction simulation

Use the blockchain-query skill and ContractAnalyzer subagent as needed.
