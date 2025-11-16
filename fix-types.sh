#!/bin/bash

# Fix DeFiAgent
sed -i 's/executeDomainTaskSafe<SwapResult>(\x27defi_add_liquidity\x27, params)/executeDomainTaskSafe<LiquidityResult>(\x27defi_add_liquidity\x27, params as unknown as Record<string, unknown>)/g' src/agents/DeFiAgent.ts
sed -i 's/executeDomainTaskSafe<LiquidityResult>(\x27defi_remove_liquidity\x27, params)/executeDomainTaskSafe<LiquidityResult>(\x27defi_remove_liquidity\x27, params as unknown as Record<string, unknown>)/g' src/agents/DeFiAgent.ts
sed -i 's/executeDomainTask<DEXQuote\[\]>(\x27defi_get_quote\x27, params)/executeDomainTask<DEXQuote[]>(\x27defi_get_quote\x27, params as unknown as Record<string, unknown>)/g' src/agents/DeFiAgent.ts

echo "Fixed DeFiAgent"
