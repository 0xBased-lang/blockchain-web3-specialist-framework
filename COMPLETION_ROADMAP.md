# Framework Completion Roadmap

**Goal:** Achieve 100% implementation completion
**Current Status:** 85% → Target: 100%
**Estimated Total Time:** 3-4 weeks (1 developer)
**Priority:** High (fills critical gaps in framework)

---

## Executive Summary

This roadmap addresses three major gaps:
1. **Missing 5 Specialized Agents** (40% agent completion → 100%)
2. **Skills/Commands Runtime Implementation** (documentation-only → fully functional)
3. **8 Enhancement TODOs** (complete deferred features)

**Total Deliverables:** 5 agents, 6 skill handlers, 6 command handlers, 8 feature completions, 50+ tests

---

## Phase 1: Critical Fixes & Foundation (Priority: CRITICAL)

**Duration:** 2-3 days
**Blockers:** Must complete before other phases

### 1.1 Fix ESLint Version Mismatch 🔴 BLOCKING

**Issue:** ESLint v9 installed but v8 config used
**Impact:** Lint fails, cannot catch `any` types, CI lint silently skipped

**Implementation:**
```bash
# Option A: Downgrade to ESLint 8 (RECOMMENDED - faster)
pnpm remove eslint
pnpm add -D eslint@^8.57.1
pnpm lint  # Verify works

# Option B: Migrate to ESLint 9 flat config (2-4 hours work)
# See: https://eslint.org/docs/latest/use/configure/migration-guide
# Rename .eslintrc.json → eslint.config.js
# Rewrite config in flat format
```

**Estimated Time:** 30 minutes (Option A) or 4 hours (Option B)
**Files Changed:** package.json, optionally .eslintrc.json → eslint.config.js
**Testing:** Run `pnpm lint` on entire codebase

### 1.2 Remove All `any` Types 🔴 BLOCKING

**Issue:** 21 instances of `any` across 8 files (violates CLAUDE.md)

**Files to Fix:**
```typescript
src/subagents/TransactionBuilder.ts (3 instances)
  - Line 94: (baseConfig as any).ethereumProvider
  - Line 97: (baseConfig as any).solanaConnection
  - Line 676: const simulationRequest: any = {...}

src/subagents/ContractAnalyzer.ts (1 instance)
  - Line 531: private normalizeMetadata(metadata: any)

src/mcp-servers/multichain/tools.ts (4 instances)
  - Line 309: queryEthereumBalance(params: any)
  - Line 334: querySolanaBalance(params: any)
  - Line 401: sendEthereumTransaction(params: any)
  - Line 508: transferERC20Token(_params: any)

src/mcp-servers/ethereum/tools.ts (1 instance)
  - Line 309: const result = await (contract[method] as any)(...)

src/mcp-servers/multichain/resources.ts (3 instances)
  - Lines 223, 334, 345, 407: Type casting to any

src/agents/communication.ts, workflow.ts, OrchestratorAgent.ts (9 instances)
  - Mostly comments or legitimate uses (review needed)
```

**Strategy:**
1. Create proper types for all `any` instances
2. Use `unknown` + type guards where dynamic types needed
3. Use branded types for addresses
4. Use Zod schemas for runtime validation

**Estimated Time:** 1 day
**Files Changed:** 8 files
**Testing:** Must pass `pnpm typecheck` and `pnpm lint`

### 1.3 Update CI/CD Configuration

**Changes:**
```yaml:.github/workflows/ci.yml
# Remove line 39: continue-on-error: true
# Make lint failures block merges
- name: Lint
  run: pnpm lint
  # continue-on-error: true  ← REMOVE THIS
```

**Estimated Time:** 15 minutes
**Files Changed:** .github/workflows/ci.yml
**Testing:** Trigger CI run and verify lint failures block

---

## Phase 2: Implement 5 Specialized Agents (Priority: HIGH)

**Duration:** 2 weeks
**Dependencies:** Phase 1 must be complete

### Architecture Overview

All agents follow this pattern:
```
src/agents/
  ├── BaseAgent.ts (existing)
  ├── OrchestratorAgent.ts (existing)
  ├── BlockchainAgent.ts (NEW)
  ├── DeFiAgent.ts (NEW)
  ├── NFTAgent.ts (NEW)
  ├── SecurityAgent.ts (NEW)
  └── AnalyticsAgent.ts (NEW)
```

Each agent extends `BaseAgent` and implements:
- `plan(task: Task): Promise<TaskPlan>` - Create execution plan
- `execute(plan: TaskPlan): Promise<Result>` - Execute plan steps
- `validate(result: Result): Promise<ValidationResult>` - Validate results

### 2.1 BlockchainAgent Implementation

**Purpose:** General blockchain operations (queries, transactions, monitoring)

**Capabilities:**
- Balance queries (native + tokens)
- Transaction submission and monitoring
- Block queries
- Contract interaction
- Multi-chain support

**Delegates to Subagents:**
- WalletManager (for signing)
- TransactionBuilder (for TX construction)
- GasOptimizer (for gas pricing)
- NonceManager (for nonce tracking)

**File Structure:**
```typescript
// src/agents/BlockchainAgent.ts (new file, ~800-1000 LOC)

import { BaseAgent } from './BaseAgent.js';
import { WalletManager } from '../subagents/WalletManager.js';
import { TransactionBuilder } from '../subagents/TransactionBuilder.js';
import { GasOptimizer } from '../subagents/GasOptimizer.js';
import { NonceManager } from '../subagents/NonceManager.js';

export interface BlockchainAgentConfig extends AgentConfig {
  readonly chains: Chain[];
  readonly walletManager?: WalletManager;
  readonly gasOptimizer?: GasOptimizer;
  readonly nonceManager?: NonceManager;
}

export class BlockchainAgent extends BaseAgent {
  private readonly chains: Set<Chain>;
  private readonly walletManager?: WalletManager;
  private readonly txBuilder: TransactionBuilder;
  private readonly gasOptimizer?: GasOptimizer;
  private readonly nonceManager?: NonceManager;

  constructor(config: BlockchainAgentConfig) {
    super({
      ...config,
      capabilities: [
        'balance_query',
        'transaction_send',
        'transaction_monitor',
        'block_query',
        'contract_call',
        'multi_chain',
      ],
    });

    this.chains = new Set(config.chains);
    this.walletManager = config.walletManager;
    this.gasOptimizer = config.gasOptimizer;
    this.nonceManager = config.nonceManager;
    this.txBuilder = new TransactionBuilder({...});
  }

  async plan(task: Task): Promise<TaskPlan> {
    // Decompose task by type
    switch (task.type) {
      case 'balance_query':
        return this.planBalanceQuery(task);
      case 'transaction_send':
        return this.planTransactionSend(task);
      case 'transaction_monitor':
        return this.planTransactionMonitor(task);
      case 'block_query':
        return this.planBlockQuery(task);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  async execute(plan: TaskPlan): Promise<Result> {
    // Execute steps sequentially or in parallel based on dependencies
    const results: Result[] = [];

    for (const step of plan.steps) {
      const result = await this.executeStep(step);
      results.push(result);

      if (!result.success && !step.optional) {
        // Stop on first critical failure
        return {
          success: false,
          error: `Step ${step.id} failed: ${result.error}`,
          data: { completedSteps: results },
        };
      }
    }

    return {
      success: true,
      data: this.aggregateResults(results),
    };
  }

  async validate(result: Result): Promise<ValidationResult> {
    // Validate based on task type
    const errors: string[] = [];

    if (!result.success) {
      errors.push('Execution failed');
    }

    // Type-specific validation
    if (result.data?.transaction) {
      // Validate transaction receipt
      if (!result.data.transaction.hash) {
        errors.push('Missing transaction hash');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Private methods for specific operations
  private async planBalanceQuery(task: Task): Promise<TaskPlan> {...}
  private async planTransactionSend(task: Task): Promise<TaskPlan> {...}
  private async executeStep(step: TaskStep): Promise<Result> {...}
  private aggregateResults(results: Result[]): unknown {...}
}
```

**Test File:**
```typescript
// tests/unit/agents/BlockchainAgent.test.ts (new file, ~500 LOC)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlockchainAgent } from '../../../src/agents/BlockchainAgent.js';

describe('BlockchainAgent', () => {
  describe('Balance Queries', () => {
    it('should query ETH balance', async () => {...});
    it('should query ERC20 balance', async () => {...});
    it('should query Solana balance', async () => {...});
    it('should handle multi-chain queries', async () => {...});
  });

  describe('Transaction Sending', () => {
    it('should send simple transfer', async () => {...});
    it('should send contract interaction', async () => {...});
    it('should optimize gas', async () => {...});
    it('should handle nonce conflicts', async () => {...});
  });

  describe('Error Handling', () => {
    it('should handle RPC failures', async () => {...});
    it('should retry failed transactions', async () => {...});
  });
});
```

**Estimated Time:** 3-4 days
**Files Changed:** 1 new agent, 1 new test file
**Testing:** 30+ test cases

### 2.2 DeFiAgent Implementation

**Purpose:** DeFi operations (swaps, lending, staking, yield farming)

**Capabilities:**
- DEX swaps (Uniswap, SushiSwap, Curve, Jupiter)
- Lending/borrowing (Aave, Compound)
- Staking operations
- Liquidity provision
- Yield optimization
- Slippage protection

**Delegates to Subagents:**
- BlockchainAgent (for transactions)
- PriceOracle (for price data)
- TransactionSimulator (for simulation)
- GasOptimizer (for gas)

**Key Methods:**
```typescript
export class DeFiAgent extends BaseAgent {
  async executeSwap(params: SwapParams): Promise<Result>
  async provideLiquidity(params: LiquidityParams): Promise<Result>
  async stake(params: StakeParams): Promise<Result>
  async harvest(params: HarvestParams): Promise<Result>
  async calculateOptimalRoute(params: RouteParams): Promise<Route>
  async estimateSlippage(params: SwapParams): Promise<number>
}
```

**Estimated Time:** 4-5 days
**Files Changed:** 1 new agent, 1 new test file
**Testing:** 35+ test cases

### 2.3 NFTAgent Implementation

**Purpose:** NFT operations (minting, trading, analytics)

**Capabilities:**
- NFT minting (ERC721, ERC1155)
- Marketplace listing/buying
- Metadata management
- Ownership verification
- Rarity analysis
- Collection analytics

**Delegates to Subagents:**
- BlockchainAgent (for transactions)
- ContractAnalyzer (for contract verification)
- TransactionSimulator (for simulation)

**Key Methods:**
```typescript
export class NFTAgent extends BaseAgent {
  async mintNFT(params: MintParams): Promise<Result>
  async transferNFT(params: TransferParams): Promise<Result>
  async listNFT(params: ListParams): Promise<Result>
  async buyNFT(params: BuyParams): Promise<Result>
  async analyzeCollection(params: AnalysisParams): Promise<CollectionStats>
  async verifyOwnership(params: OwnershipParams): Promise<boolean>
}
```

**Estimated Time:** 3-4 days
**Files Changed:** 1 new agent, 1 new test file
**Testing:** 30+ test cases

### 2.4 SecurityAgent Implementation

**Purpose:** Security validation, auditing, risk assessment

**Capabilities:**
- Transaction validation (pre-flight checks)
- Contract security analysis
- Risk assessment
- Fraud detection
- Vulnerability scanning
- Approval analysis

**Delegates to Subagents:**
- ContractAnalyzer (for contract analysis)
- TransactionSimulator (for simulation)
- PriceOracle (for value validation)

**Key Methods:**
```typescript
export class SecurityAgent extends BaseAgent {
  async validateTransaction(tx: Transaction): Promise<ValidationResult>
  async analyzeContract(address: string, chain: Chain): Promise<SecurityReport>
  async assessRisk(operation: Operation): Promise<RiskLevel>
  async detectFraud(params: FraudCheckParams): Promise<FraudReport>
  async scanApprovals(address: string): Promise<ApprovalReport>
}
```

**Special Features:**
- Integration with malicious contract database
- Real-time threat detection
- Approval scanning (detect unlimited approvals)
- MEV protection recommendations

**Estimated Time:** 4-5 days
**Files Changed:** 1 new agent, 1 new test file
**Testing:** 40+ test cases (security-critical)

### 2.5 AnalyticsAgent Implementation

**Purpose:** Data analysis, reporting, portfolio tracking

**Capabilities:**
- Portfolio valuation
- P&L analysis
- Transaction history
- Gas analytics
- Performance metrics
- Custom reports

**Delegates to Subagents:**
- BlockchainAgent (for data queries)
- PriceOracle (for pricing)
- DeFiAgent (for protocol data)

**Key Methods:**
```typescript
export class AnalyticsAgent extends BaseAgent {
  async calculatePortfolioValue(address: string): Promise<PortfolioValue>
  async analyzePnL(params: PnLParams): Promise<PnLReport>
  async generateReport(params: ReportParams): Promise<Report>
  async trackGasSpending(address: string): Promise<GasReport>
  async analyzeTransactions(params: TxAnalysisParams): Promise<TxReport>
}
```

**Estimated Time:** 3-4 days
**Files Changed:** 1 new agent, 1 new test file
**Testing:** 30+ test cases

### 2.6 Integration with OrchestratorAgent

**Update OrchestratorAgent to register all agents:**

```typescript:src/agents/OrchestratorAgent.ts
// Add imports
import { BlockchainAgent } from './BlockchainAgent.js';
import { DeFiAgent } from './DeFiAgent.js';
import { NFTAgent } from './NFTAgent.js';
import { SecurityAgent } from './SecurityAgent.js';
import { AnalyticsAgent } from './AnalyticsAgent.js';

// Update identifyRequiredAgents method
private identifyRequiredAgents(task: Task): string[] {
  const agents: string[] = [];

  // Map task types to required agents
  if (task.type.includes('balance') || task.type.includes('transaction')) {
    agents.push('blockchain');
  }
  if (task.type.includes('swap') || task.type.includes('defi')) {
    agents.push('defi');
  }
  if (task.type.includes('nft') || task.type.includes('mint')) {
    agents.push('nft');
  }
  if (task.type.includes('security') || task.type.includes('audit')) {
    agents.push('security');
  }
  if (task.type.includes('analytics') || task.type.includes('report')) {
    agents.push('analytics');
  }

  return agents;
}
```

**Factory for creating agents:**

```typescript
// src/agents/AgentFactory.ts (new file, ~200 LOC)

export class AgentFactory {
  static createBlockchainAgent(config: BlockchainAgentConfig): BlockchainAgent {
    return new BlockchainAgent(config);
  }

  static createDeFiAgent(config: DeFiAgentConfig): DeFiAgent {
    return new DeFiAgent(config);
  }

  static createNFTAgent(config: NFTAgentConfig): NFTAgent {
    return new NFTAgent(config);
  }

  static createSecurityAgent(config: SecurityAgentConfig): SecurityAgent {
    return new SecurityAgent(config);
  }

  static createAnalyticsAgent(config: AnalyticsAgentConfig): AnalyticsAgent {
    return new AnalyticsAgent(config);
  }

  static createFullStack(config: FullStackConfig): OrchestratorAgent {
    const orchestrator = new OrchestratorAgent(config.orchestrator);

    // Create and register all agents
    const blockchain = this.createBlockchainAgent(config.blockchain);
    const defi = this.createDeFiAgent(config.defi);
    const nft = this.createNFTAgent(config.nft);
    const security = this.createSecurityAgent(config.security);
    const analytics = this.createAnalyticsAgent(config.analytics);

    orchestrator.registerAgent('blockchain', blockchain);
    orchestrator.registerAgent('defi', defi);
    orchestrator.registerAgent('nft', nft);
    orchestrator.registerAgent('security', security);
    orchestrator.registerAgent('analytics', analytics);

    return orchestrator;
  }
}
```

**Estimated Time:** 1 day
**Files Changed:** OrchestratorAgent.ts, new AgentFactory.ts
**Testing:** Integration tests

---

## Phase 3: Implement Skills & Commands Runtime Handlers (Priority: MEDIUM)

**Duration:** 1 week
**Dependencies:** Phase 2 (agents must exist)

### Understanding Skills vs Commands

**Skills** (.claude/skills/*/SKILL.md):
- Markdown instruction documents
- Claude Code reads these to understand how to handle requests
- No runtime execution needed (Claude interprets the instructions)

**Commands** (.claude/commands/*.md):
- Slash commands that users invoke
- Need runtime handlers to execute operations
- Bridge between user input and agent system

### 3.1 Command Handler Architecture

Create a command handler system:

```typescript
// src/commands/CommandHandler.ts (new file, ~300 LOC)

import { OrchestratorAgent } from '../agents/OrchestratorAgent.js';
import { BlockchainAgent } from '../agents/BlockchainAgent.js';
import { DeFiAgent } from '../agents/DeFiAgent.js';

export interface CommandContext {
  readonly args: string[];
  readonly flags: Record<string, string | boolean>;
  readonly user?: string;
}

export interface CommandResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly data?: unknown;
}

export abstract class CommandHandler {
  abstract execute(context: CommandContext): Promise<CommandResult>;
  abstract validate(context: CommandContext): boolean;
  abstract help(): string;
}

// Command registry
export class CommandRegistry {
  private readonly handlers: Map<string, CommandHandler>;

  constructor() {
    this.handlers = new Map();
  }

  register(name: string, handler: CommandHandler): void {
    this.handlers.set(name, handler);
  }

  async execute(command: string, context: CommandContext): Promise<CommandResult> {
    const handler = this.handlers.get(command);

    if (!handler) {
      return {
        success: false,
        output: '',
        error: `Unknown command: ${command}`,
      };
    }

    if (!handler.validate(context)) {
      return {
        success: false,
        output: '',
        error: 'Invalid command arguments',
      };
    }

    return await handler.execute(context);
  }
}
```

### 3.2 Individual Command Implementations

**File Structure:**
```
src/commands/
  ├── CommandHandler.ts (base classes)
  ├── QueryCommand.ts
  ├── AnalyzeCommand.ts
  ├── DeployCommand.ts
  ├── DebugCommand.ts
  ├── SwapCommand.ts
  ├── StatusCommand.ts
  └── index.ts (exports)
```

**Example: QueryCommand**

```typescript
// src/commands/QueryCommand.ts (~200 LOC)

export class QueryCommand extends CommandHandler {
  constructor(
    private readonly blockchainAgent: BlockchainAgent,
    private readonly analyticsAgent: AnalyticsAgent
  ) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const [input] = context.args;

    // Detect input type
    const type = this.detectInputType(input);

    switch (type) {
      case 'ethereum_address':
        return await this.queryEthereumAddress(input, context);
      case 'solana_address':
        return await this.querySolanaAddress(input, context);
      case 'transaction_hash':
        return await this.queryTransaction(input, context);
      case 'block_number':
        return await this.queryBlock(input, context);
      default:
        return {
          success: false,
          output: '',
          error: 'Unable to detect input type',
        };
    }
  }

  validate(context: CommandContext): boolean {
    return context.args.length >= 1;
  }

  help(): string {
    return `
Usage: /query <address|tx_hash|block>

Query blockchain data including balances, transactions, and contracts.

Examples:
  /query 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  /query 0xabc...def (transaction hash)
  /query 12345678 (block number)
  /query vitalik.eth (ENS name)

Flags:
  --chain <chain>      Specify chain (ethereum, polygon, etc.)
  --all-chains         Query across all chains
  --tokens             Include token balances
  --history            Include transaction history
    `;
  }

  private detectInputType(input: string): string {
    if (/^0x[a-fA-F0-9]{40}$/.test(input)) return 'ethereum_address';
    if (/^0x[a-fA-F0-9]{64}$/.test(input)) return 'transaction_hash';
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) return 'solana_address';
    if (/^\d+$/.test(input)) return 'block_number';
    if (input.endsWith('.eth')) return 'ens_name';
    return 'unknown';
  }

  private async queryEthereumAddress(
    address: string,
    context: CommandContext
  ): Promise<CommandResult> {
    const task = {
      id: `query-${Date.now()}`,
      type: 'balance_query',
      params: {
        address,
        chain: context.flags.chain ?? 'ethereum',
        includeTokens: context.flags.tokens ?? true,
      },
    };

    const result = await this.blockchainAgent.executeTask(task);

    if (!result.success) {
      return {
        success: false,
        output: '',
        error: result.error,
      };
    }

    // Format output
    const output = this.formatAddressOutput(result.data);

    return {
      success: true,
      output,
      data: result.data,
    };
  }

  private formatAddressOutput(data: unknown): string {
    // Format into readable output (similar to command docs)
    return `
╔════════════════════════════════════════╗
║  Address Query Result                  ║
╚════════════════════════════════════════╝

Address: ${data.address}
...
    `;
  }
}
```

**Repeat for all 6 commands:**
- QueryCommand ✅ (example above)
- AnalyzeCommand (contract analysis)
- DeployCommand (contract deployment)
- DebugCommand (transaction debugging)
- SwapCommand (DEX swaps)
- StatusCommand (system status)

**Estimated Time:** 5-6 days (all 6 commands)
**Files Changed:** 7 new files (1 base + 6 commands)
**Testing:** 30+ test cases (5 per command)

### 3.3 Skill Integration

**Skills don't need runtime handlers** - they're instruction documents for Claude Code.

However, we should create a **Skill Helper** utility:

```typescript
// src/skills/SkillHelper.ts (new file, ~150 LOC)

/**
 * Helper utilities for skills
 *
 * Skills are markdown instruction documents that Claude reads.
 * This helper provides utilities for common skill operations.
 */
export class SkillHelper {
  /**
   * Parse skill arguments from user input
   */
  static parseSkillArgs(input: string): Record<string, unknown> {
    // Extract flags, addresses, etc.
  }

  /**
   * Validate address format
   */
  static validateAddress(address: string, chain: Chain): boolean {
    // Chain-specific validation
  }

  /**
   * Format skill output
   */
  static formatOutput(data: unknown, format: 'table' | 'json' | 'text'): string {
    // Format data for display
  }
}
```

**Estimated Time:** 1 day
**Files Changed:** 1 new file
**Testing:** 15 test cases

---

## Phase 4: Complete 8 Enhancement TODOs (Priority: MEDIUM)

**Duration:** 1 week
**Dependencies:** None (can run in parallel with Phase 2/3)

### 4.1 PriceOracle: Implement DEX Integrations (5 TODOs)

**Current State:** Only Chainlink is implemented
**Goal:** Add Uniswap V2, Uniswap V3, SushiSwap, Curve, TWAP

**Implementation:**

```typescript:src/subagents/PriceOracle.ts
// Add DEX source implementations

private async fetchUniswapV3Price(pair: string): Promise<PriceData> {
  // TODO: Implement Uniswap V3 TWAP (Line 211)
  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, factoryAbi, provider);
  const poolAddress = await factory.getPool(token0, token1, fee);
  const pool = new ethers.Contract(poolAddress, poolAbi, provider);

  // Get slot0 for current price
  const slot0 = await pool.slot0();
  const sqrtPriceX96 = slot0.sqrtPriceX96;

  // Calculate price from sqrtPriceX96
  const price = this.calculatePriceFromSqrtPrice(sqrtPriceX96, decimals0, decimals1);

  // Get TWAP
  const twap = await this.calculateTWAP(pool, TWAP_WINDOW);

  return {
    source: 'uniswap_v3',
    pair,
    price,
    twap,
    timestamp: Date.now(),
  };
}

private async fetchUniswapV2Price(pair: string): Promise<PriceData> {
  // TODO: Implement Uniswap V2 (Line 219)
  const factory = new ethers.Contract(UNISWAP_V2_FACTORY, factoryAbi, provider);
  const pairAddress = await factory.getPair(token0, token1);
  const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);

  const reserves = await pairContract.getReserves();
  const price = reserves.reserve1 / reserves.reserve0; // Adjust for decimals

  return {
    source: 'uniswap_v2',
    pair,
    price,
    timestamp: Date.now(),
  };
}

private async fetchSushiSwapPrice(pair: string): Promise<PriceData> {
  // TODO: Implement SushiSwap (Line 227)
  // Similar to Uniswap V2 (same interface)
  // Use SushiSwap factory address
}

private async fetchCurvePrice(pair: string): Promise<PriceData> {
  // TODO: Implement Curve (Line 235)
  const pool = new ethers.Contract(poolAddress, curvePoolAbi, provider);
  const dy = await pool.get_dy(i, j, dx);
  const price = dy / dx;

  return {
    source: 'curve',
    pair,
    price,
    timestamp: Date.now(),
  };
}

private async calculateTWAP(pool: Contract, window: number): Promise<number> {
  // TODO: Implement proper TWAP calculation (Line 414)
  const observationsCount = await pool.observationCardinality();

  // Get observations for TWAP window
  const [tickCumulatives] = await pool.observe([window, 0]);
  const tickDelta = tickCumulatives[1] - tickCumulatives[0];
  const avgTick = tickDelta / window;

  // Convert tick to price
  const price = Math.pow(1.0001, avgTick);

  return price;
}
```

**Estimated Time:** 3-4 days
**Files Changed:** src/subagents/PriceOracle.ts
**Testing:** 25+ test cases (5 per DEX)

### 4.2 TransactionSimulator: Implement Tenderly Integration (1 TODO)

**Current State:** Only local simulation works
**Goal:** Add Tenderly API integration for advanced simulation

**Implementation:**

```typescript:src/subagents/TransactionSimulator.ts
private async simulateWithTenderly(
  transaction: Transaction,
  chain: Chain
): Promise<SimulationResult> {
  // TODO: Implement Tenderly API integration (Line 249)

  const tenderlyApiKey = process.env['TENDERLY_API_KEY'];
  const tenderlyProject = process.env['TENDERLY_PROJECT'];

  if (!tenderlyApiKey || !tenderlyProject) {
    logger.warn('Tenderly credentials not configured, using local simulation');
    return await this.simulateLocally(transaction, chain);
  }

  const url = `https://api.tenderly.co/api/v1/account/${tenderlyProject}/project/${tenderlyProject}/simulate`;

  const payload = {
    network_id: this.getNetworkId(chain),
    from: transaction.from,
    to: transaction.to,
    input: transaction.data,
    gas: transaction.gasLimit,
    gas_price: transaction.gasPrice,
    value: transaction.value,
    save: false, // Don't save simulation
    save_if_fails: false,
    simulation_type: 'quick',
  };

  const response = await axios.post(url, payload, {
    headers: {
      'X-Access-Key': tenderlyApiKey,
      'Content-Type': 'application/json',
    },
  });

  const simulation = response.data.transaction;

  return {
    success: simulation.status,
    gasUsed: simulation.gas_used,
    logs: simulation.logs,
    trace: simulation.call_trace,
    stateChanges: this.extractStateChanges(simulation),
    revertReason: simulation.error_message,
  };
}

private getNetworkId(chain: Chain): string {
  const mapping = {
    ethereum: '1',
    polygon: '137',
    arbitrum: '42161',
    optimism: '10',
  };
  return mapping[chain] ?? '1';
}
```

**Configuration:**
```typescript
// .env.example
TENDERLY_API_KEY=your_api_key_here
TENDERLY_PROJECT=your_project_id
```

**Estimated Time:** 1 day
**Files Changed:** src/subagents/TransactionSimulator.ts, .env.example
**Testing:** 10 test cases (with mocked Tenderly API)

### 4.3 ContractAnalyzer: Implement Etherscan/Sourcify Auto-Fetch (1 TODO)

**Current State:** Requires source code to be provided
**Goal:** Auto-fetch from Etherscan/Sourcify

**Implementation:**

```typescript:src/subagents/ContractAnalyzer.ts
private async fetchSourceCode(
  address: string,
  chain: Chain
): Promise<string | null> {
  // TODO: Fetch from Etherscan/Sourcify if API key provided (Line 588)

  const etherscanApiKey = process.env['ETHERSCAN_API_KEY'];

  if (etherscanApiKey) {
    try {
      return await this.fetchFromEtherscan(address, chain, etherscanApiKey);
    } catch (error) {
      logger.warn('Etherscan fetch failed, trying Sourcify', { error });
    }
  }

  // Try Sourcify (no API key needed)
  try {
    return await this.fetchFromSourcify(address, chain);
  } catch (error) {
    logger.warn('Sourcify fetch failed', { error });
    return null;
  }
}

private async fetchFromEtherscan(
  address: string,
  chain: Chain,
  apiKey: string
): Promise<string> {
  const baseUrl = this.getEtherscanUrl(chain);
  const url = `${baseUrl}/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;

  const response = await axios.get(url);

  if (response.data.status !== '1') {
    throw new Error('Contract not verified on Etherscan');
  }

  const sourceCode = response.data.result[0].SourceCode;
  return sourceCode;
}

private async fetchFromSourcify(
  address: string,
  chain: Chain
): Promise<string> {
  const chainId = this.getChainId(chain);
  const url = `https://repo.sourcify.dev/contracts/full_match/${chainId}/${address}/`;

  const response = await axios.get(url);

  // Sourcify returns all files, concatenate them
  const files = response.data.files;
  const sourceCode = files
    .filter((f: any) => f.name.endsWith('.sol'))
    .map((f: any) => f.content)
    .join('\n\n');

  return sourceCode;
}

private getEtherscanUrl(chain: Chain): string {
  const urls = {
    ethereum: 'https://api.etherscan.io',
    polygon: 'https://api.polygonscan.com',
    arbitrum: 'https://api.arbiscan.io',
    optimism: 'https://api-optimistic.etherscan.io',
  };
  return urls[chain] ?? urls.ethereum;
}
```

**Configuration:**
```typescript
// .env.example
ETHERSCAN_API_KEY=your_api_key_here
```

**Estimated Time:** 1 day
**Files Changed:** src/subagents/ContractAnalyzer.ts, .env.example
**Testing:** 10 test cases

### 4.4 Planning: Implement Critical Path Analysis (1 TODO)

**Current State:** Basic parallel execution
**Goal:** Proper Critical Path Method (CPM) algorithm

**Implementation:**

```typescript:src/agents/planning.ts
export class TaskPlanner {
  /**
   * Calculate critical path for parallel execution optimization
   *
   * Uses Critical Path Method (CPM) to identify:
   * - Longest dependency chain (critical path)
   * - Tasks that can run in parallel
   * - Slack time for non-critical tasks
   * - Optimal execution order
   */
  calculateCriticalPath(steps: TaskStep[]): CriticalPathResult {
    // TODO: Implement proper critical path analysis (Line 366)

    // 1. Build dependency graph
    const graph = this.buildDependencyGraph(steps);

    // 2. Calculate earliest start times (forward pass)
    const earlyStart = new Map<string, number>();
    const earlyFinish = new Map<string, number>();

    for (const step of this.topologicalSort(graph)) {
      const maxDependencyFinish = Math.max(
        0,
        ...step.dependsOn.map(depId => earlyFinish.get(depId) ?? 0)
      );
      earlyStart.set(step.id, maxDependencyFinish);
      earlyFinish.set(step.id, maxDependencyFinish + step.estimatedTime);
    }

    // 3. Calculate latest start times (backward pass)
    const projectDuration = Math.max(...earlyFinish.values());
    const lateStart = new Map<string, number>();
    const lateFinish = new Map<string, number>();

    for (const step of this.reverseTopologicalSort(graph)) {
      const minSuccessorStart = this.hasSuccessors(step, graph)
        ? Math.min(
            ...this.getSuccessors(step, graph)
              .map(succ => lateStart.get(succ.id) ?? projectDuration)
          )
        : projectDuration;

      lateFinish.set(step.id, minSuccessorStart);
      lateStart.set(step.id, minSuccessorStart - step.estimatedTime);
    }

    // 4. Calculate slack and identify critical path
    const criticalPath: string[] = [];
    const slack = new Map<string, number>();

    for (const step of steps) {
      const stepSlack = (lateStart.get(step.id) ?? 0) - (earlyStart.get(step.id) ?? 0);
      slack.set(step.id, stepSlack);

      if (stepSlack === 0) {
        criticalPath.push(step.id);
      }
    }

    return {
      criticalPath,
      projectDuration,
      earlyStart,
      earlyFinish,
      lateStart,
      lateFinish,
      slack,
      parallelizableGroups: this.identifyParallelGroups(steps, slack),
    };
  }

  /**
   * Identify groups of tasks that can run in parallel
   */
  private identifyParallelGroups(
    steps: TaskStep[],
    slack: Map<string, number>
  ): TaskStep[][] {
    const levels = new Map<number, TaskStep[]>();

    for (const step of steps) {
      const level = this.calculateLevel(step, steps);
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(step);
    }

    return Array.from(levels.values());
  }

  private calculateLevel(step: TaskStep, allSteps: TaskStep[]): number {
    if (step.dependsOn.length === 0) {
      return 0;
    }

    const dependencyLevels = step.dependsOn.map(depId => {
      const dep = allSteps.find(s => s.id === depId);
      return dep ? this.calculateLevel(dep, allSteps) : 0;
    });

    return Math.max(...dependencyLevels) + 1;
  }

  private topologicalSort(graph: Map<string, TaskStep>): TaskStep[] {
    const sorted: TaskStep[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (step: TaskStep): void => {
      if (temp.has(step.id)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(step.id)) {
        return;
      }

      temp.add(step.id);

      for (const depId of step.dependsOn) {
        const dep = graph.get(depId);
        if (dep) {
          visit(dep);
        }
      }

      temp.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of graph.values()) {
      if (!visited.has(step.id)) {
        visit(step);
      }
    }

    return sorted;
  }
}

interface CriticalPathResult {
  criticalPath: string[];
  projectDuration: number;
  earlyStart: Map<string, number>;
  earlyFinish: Map<string, number>;
  lateStart: Map<string, number>;
  lateFinish: Map<string, number>;
  slack: Map<string, number>;
  parallelizableGroups: TaskStep[][];
}
```

**Estimated Time:** 2 days
**Files Changed:** src/agents/planning.ts
**Testing:** 15 test cases (including circular dependency detection)

---

## Phase 5: Testing & Integration (Priority: HIGH)

**Duration:** 3-4 days
**Dependencies:** All previous phases

### 5.1 Agent Integration Tests

Create comprehensive integration tests:

```typescript
// tests/integration/agent-integration.test.ts (new file, ~800 LOC)

import { describe, it, expect, beforeAll } from 'vitest';
import { AgentFactory } from '../../src/agents/AgentFactory.js';

describe('Agent Integration Tests', () => {
  let orchestrator: OrchestratorAgent;
  let blockchain: BlockchainAgent;
  let defi: DeFiAgent;
  let nft: NFTAgent;
  let security: SecurityAgent;
  let analytics: AnalyticsAgent;

  beforeAll(() => {
    // Initialize full agent stack
    orchestrator = AgentFactory.createFullStack({...});
    blockchain = orchestrator.getAgent('blockchain');
    defi = orchestrator.getAgent('defi');
    // ...
  });

  describe('Blockchain → DeFi Integration', () => {
    it('should execute swap with proper validation', async () => {
      // 1. Query balance (BlockchainAgent)
      // 2. Validate swap (SecurityAgent)
      // 3. Execute swap (DeFiAgent)
      // 4. Monitor transaction (BlockchainAgent)
      // 5. Update analytics (AnalyticsAgent)
    });
  });

  describe('NFT → Security Integration', () => {
    it('should mint NFT with security checks', async () => {
      // 1. Analyze contract (SecurityAgent)
      // 2. Simulate transaction (SecurityAgent)
      // 3. Mint NFT (NFTAgent)
      // 4. Verify ownership (BlockchainAgent)
    });
  });

  describe('Multi-Agent Workflows', () => {
    it('should coordinate complex DeFi operation', async () => {
      // Test full workflow with all agents
    });
  });
});
```

**Estimated Time:** 2 days
**Files Changed:** 1 new integration test file
**Testing:** 30+ integration test cases

### 5.2 End-to-End Command Tests

```typescript
// tests/e2e/command-execution.test.ts (new file, ~500 LOC)

import { describe, it, expect } from 'vitest';
import { CommandRegistry } from '../../src/commands/CommandHandler.js';

describe('E2E Command Tests', () => {
  let registry: CommandRegistry;

  beforeAll(() => {
    // Setup command registry with all commands
    registry = setupCommandRegistry();
  });

  describe('/query command', () => {
    it('should query Ethereum address', async () => {
      const result = await registry.execute('query', {
        args: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
        flags: {},
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Balance');
    });
  });

  // ... more command tests
});
```

**Estimated Time:** 1-2 days
**Files Changed:** 1 new e2e test file
**Testing:** 20+ e2e test cases

### 5.3 Update Coverage Requirements

Ensure all new code has proper coverage:

```typescript:vitest.config.ts
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
  include: [
    'src/agents/**/*.ts',
    'src/commands/**/*.ts',
    'src/subagents/**/*.ts',
  ],
}
```

**Estimated Time:** 1 day
**Files Changed:** vitest.config.ts
**Testing:** Run full coverage report

---

## Phase 6: Documentation Updates (Priority: MEDIUM)

**Duration:** 2-3 days
**Dependencies:** All previous phases

### 6.1 Update Architecture Documentation

```markdown:docs/architecture/01-system-architecture.md
# Add sections for:
- All 5 specialized agents with diagrams
- Command handler architecture
- Agent interaction patterns
- Data flow diagrams
```

### 6.2 Create Agent-Specific Guides

Create detailed guides for each agent:

```
docs/agents/
  ├── BlockchainAgent.md
  ├── DeFiAgent.md
  ├── NFTAgent.md
  ├── SecurityAgent.md
  └── AnalyticsAgent.md
```

Each guide should include:
- Purpose and capabilities
- Usage examples
- API reference
- Configuration options
- Common patterns

### 6.3 Update Implementation Roadmap

Update existing implementation roadmap to reflect completion:

```markdown:IMPLEMENTATION_ROADMAP.md
# Mark all agents as ✅ COMPLETE
# Update progress indicators
# Add lessons learned section
```

### 6.4 Create Command Usage Guide

```markdown:docs/usage/COMMANDS.md
# Detailed command usage guide
- All 6 commands with examples
- Flag reference
- Common patterns
- Troubleshooting
```

**Estimated Time:** 2-3 days
**Files Changed:** 10+ documentation files

---

## Summary Timeline

| Phase | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| **Phase 1: Critical Fixes** | 2-3 days | None | CRITICAL |
| **Phase 2: 5 Agents** | 2 weeks | Phase 1 | HIGH |
| **Phase 3: Commands** | 1 week | Phase 2 | MEDIUM |
| **Phase 4: TODOs** | 1 week | None (parallel) | MEDIUM |
| **Phase 5: Testing** | 3-4 days | Phases 2,3,4 | HIGH |
| **Phase 6: Docs** | 2-3 days | Phase 5 | MEDIUM |

**Total Duration:** 3-4 weeks (sequential)
**With Parallelization:** Can reduce to ~2.5 weeks

**Critical Path:**
Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 6
(Phase 4 can run in parallel with Phase 2)

---

## Resource Requirements

### Development Team

**Minimum:** 1 senior blockchain developer

**Optimal:** 2 developers
- Developer 1: Phase 1 → Phase 2 (agents)
- Developer 2: Phase 4 (TODOs) → Phase 3 (commands)
- Both: Phase 5 (testing), Phase 6 (docs)

### Infrastructure

- Local Ethereum node (Hardhat) for testing
- Local Solana validator for testing
- API keys (optional but recommended):
  - Tenderly (for simulation)
  - Etherscan (for source code fetch)
  - Alchemy/Infura (for RPC)

### Tools

- Node.js 18+
- pnpm 8+
- TypeScript 5.3+
- Vitest for testing
- Git for version control

---

## Risk Mitigation

### Risk 1: Agent Complexity Underestimation

**Mitigation:**
- Start with BlockchainAgent (simplest)
- Use as template for other agents
- Reuse existing subagent code
- Regular code reviews

### Risk 2: Integration Issues

**Mitigation:**
- Write integration tests early
- Test each agent independently first
- Use AgentFactory for consistent setup
- Document integration patterns

### Risk 3: Test Coverage Not Met

**Mitigation:**
- Write tests alongside code (TDD)
- Run coverage checks frequently
- Aim for >80% coverage on each file
- Block PRs that reduce coverage

### Risk 4: Documentation Lag

**Mitigation:**
- Write docs as you code
- Use JSDoc comments liberally
- Generate API docs automatically
- Review docs in PRs

---

## Success Criteria

### Completion Checklist

#### Phase 1
- [ ] ESLint version fixed and lint passing
- [ ] All `any` types removed (0 instances)
- [ ] CI lint blocking enabled

#### Phase 2
- [ ] BlockchainAgent implemented and tested
- [ ] DeFiAgent implemented and tested
- [ ] NFTAgent implemented and tested
- [ ] SecurityAgent implemented and tested
- [ ] AnalyticsAgent implemented and tested
- [ ] AgentFactory created
- [ ] All agents registered with Orchestrator

#### Phase 3
- [ ] CommandHandler base class created
- [ ] All 6 commands implemented
- [ ] Command registry functional
- [ ] Help system working

#### Phase 4
- [ ] PriceOracle DEX integrations complete (5 TODOs)
- [ ] Tenderly integration complete
- [ ] Etherscan/Sourcify auto-fetch complete
- [ ] Critical path analysis complete

#### Phase 5
- [ ] Agent integration tests passing (30+ tests)
- [ ] E2E command tests passing (20+ tests)
- [ ] Coverage >80% on all new code
- [ ] All CI checks passing

#### Phase 6
- [ ] Architecture docs updated
- [ ] Agent-specific guides created (5 files)
- [ ] Command usage guide created
- [ ] Implementation roadmap updated
- [ ] README updated

### Quality Gates

**Before Phase Completion:**
1. All unit tests passing
2. All integration tests passing
3. TypeScript type check passing
4. ESLint passing
5. Coverage >80%
6. Peer review approved
7. Documentation updated

**Before Release:**
1. All phases complete
2. End-to-end tests passing
3. Manual testing complete
4. Performance benchmarks acceptable
5. Security audit passed
6. Documentation reviewed
7. CHANGELOG updated

---

## Post-Completion Roadmap

### Future Enhancements (v0.2.0+)

1. **Performance Optimization**
   - Implement caching layer
   - Add request batching
   - Optimize RPC calls
   - Add connection pooling

2. **Advanced Features**
   - MEV protection
   - Flash loan support
   - Advanced DEX aggregation
   - Portfolio optimization

3. **Additional Chains**
   - Avalanche support
   - Fantom support
   - Base support
   - More L2s

4. **Monitoring & Observability**
   - Metrics collection
   - Performance monitoring
   - Error tracking
   - Usage analytics

5. **Developer Experience**
   - CLI improvements
   - Better error messages
   - Interactive setup wizard
   - Code generation tools

---

## Conclusion

This roadmap provides a clear path to 100% framework completion. By following this plan:

**We will achieve:**
- ✅ 100% agent implementation (5/5 specialized agents)
- ✅ 100% command functionality (6/6 commands with runtime)
- ✅ 100% TODO completion (8/8 enhancements)
- ✅ 100% test coverage (>80% on all code)
- ✅ 100% documentation (all gaps filled)

**Timeline:** 3-4 weeks with 1 developer, 2.5 weeks with 2 developers

**Next Steps:**
1. Review and approve this roadmap
2. Set up development environment
3. Create feature branches
4. Begin Phase 1 (Critical Fixes)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-20
**Status:** Ready for Implementation
