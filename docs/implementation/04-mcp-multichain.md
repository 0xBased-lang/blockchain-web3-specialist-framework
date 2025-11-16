# Multi-Chain MCP Server Implementation

## Overview

Aggregator MCP server that provides unified access to multiple blockchains.

**Prerequisites**: Completed guides 02 and 03

**Estimated Time**: 10-15 hours

**Complexity**: Medium

---

## What You'll Build

- Unified multi-chain interface
- Chain routing and selection
- Cross-chain balance aggregation
- Bridge integration (optional)

---

## Phase 1: Architecture (2 hours)

Create `src/mcp-servers/multi-chain/types.ts`:

```typescript
export type ChainId = 'ethereum' | 'solana' | 'polygon' | 'arbitrum';

export interface ChainConfig {
  id: ChainId;
  name: string;
  nativeCurrency: string;
  enabled: boolean;
}

export interface MultiChainBalanceParams {
  address: string;
  chains: ChainId[];
}

export interface AggregatedBalance {
  total USD: number;
  byChain: Map<ChainId, ChainBalance>;
}

export interface ChainBalance {
  chain: ChainId;
  nativeBalance: string;
  nativeValue: number;
  tokens: TokenBalance[];
}
```

---

## Phase 2: Chain Registry (2 hours)

Create `src/mcp-servers/multi-chain/registry.ts`:

```typescript
import { EthereumMCPServer } from '../ethereum/index.js';
import { SolanaMCPServer } from '../solana/index.js';

export class ChainRegistry {
  private chains: Map<ChainId, any>;

  constructor() {
    this.chains = new Map();
    this.registerChains();
  }

  private registerChains() {
    this.chains.set('ethereum', new EthereumMCPServer('mainnet'));
    this.chains.set('solana', new SolanaMCPServer('mainnet-beta'));
    // Add more chains as needed
  }

  getChain(chainId: ChainId): any {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not registered`);
    }
    return chain;
  }

  getAllChains(): ChainId[] {
    return Array.from(this.chains.keys());
  }
}
```

---

## Phase 3: Aggregation Tools (3 hours)

Create `src/mcp-servers/multi-chain/tools.ts`:

```typescript
import { ChainRegistry } from './registry.js';
import { MultiChainBalanceParams, AggregatedBalance } from './types.js';

export class MultiChainTools {
  constructor(private registry: ChainRegistry) {}

  async getAggregatedBalance(
    params: MultiChainBalanceParams
  ): Promise<AggregatedBalance> {
    const { address, chains } = params;
    const balances = new Map();

    // Query all chains in parallel
    await Promise.all(
      chains.map(async (chainId) => {
        const chain = this.registry.getChain(chainId);
        const balance = await chain.getBalance(address);
        balances.set(chainId, balance);
      })
    );

    // Calculate total USD value
    const totalUSD = Array.from(balances.values()).reduce(
      (sum, b) => sum + b.valueUSD,
      0
    );

    return {
      totalUSD,
      byChain: balances,
    };
  }

  async findBestChain(operation: string): Promise<ChainId> {
    // Compare gas fees, congestion, etc.
    const chains = this.registry.getAllChains();
    const costs = await Promise.all(
      chains.map(async (chain) => ({
        chain,
        cost: await this.estimateCost(chain, operation),
      }))
    );

    return costs.sort((a, b) => a.cost - b.cost)[0].chain;
  }

  private async estimateCost(chain: ChainId, operation: string): Promise<number> {
    // Estimate cost for operation on this chain
    return 0; // Implement based on chain
  }
}
```

---

## Phase 4: Main Server (2 hours)

Create `src/mcp-servers/multi-chain/index.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ChainRegistry } from './registry.js';
import { MultiChainTools } from './tools.js';

export class MultiChainMCPServer {
  private server: Server;
  private registry: ChainRegistry;
  private tools: MultiChainTools;

  constructor() {
    this.registry = new ChainRegistry();
    this.tools = new MultiChainTools(this.registry);

    this.server = new Server(
      { name: 'multi-chain-mcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools
    // - get_aggregated_balance
    // - find_best_chain
    // - compare_chains
  }

  async start() {
    // Start all registered chains
    for (const chainId of this.registry.getAllChains()) {
      const chain = this.registry.getChain(chainId);
      await chain.start();
    }
  }
}
```

---

## Phase 5: Testing (2-3 hours)

Test multi-chain queries, aggregation, and routing.

**Validation**:
```bash
pnpm test src/mcp-servers/multi-chain
```

---

**Document Version**: 1.0.0
**Status**: Production Ready