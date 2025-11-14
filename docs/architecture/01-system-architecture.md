# System Architecture - Blockchain Web3 Specialist Framework

## Architecture Overview

The framework follows a **layered, microservices-inspired architecture** with clear separation of concerns. It uses the **Model Context Protocol (MCP)** as the communication backbone and implements a **hierarchical agent system** for autonomous operations.

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │Slash Commands│  │  Claude Code │  │ Skills  │
│  │  (.claude/)  │  │   Interface  │  │ (.claude/skills/) │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Agent Orchestration Layer                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Orchestrator Agent (Main)                │  │
│  │  - Task planning & decomposition                     │  │
│  │  - Agent coordination                                │  │
│  │  - Result aggregation                                │  │
│  └──────┬───────────────────────┬──────────────┬────────┘  │
│         │                       │              │            │
│  ┌──────▼────────┐  ┌──────────▼─────┐  ┌────▼──────────┐ │
│  │Blockchain Agent│  │  DeFi Agent   │  │  NFT Agent    │ │
│  │  - TX management│  │ - DEX swaps   │  │ - Minting     │ │
│  │  - Queries      │  │ - Staking     │  │ - Trading     │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
│         │                       │              │            │
│  ┌──────▼────────┐  ┌──────────▼─────┐  ┌────▼──────────┐ │
│  │Security Agent │  │Analytics Agent│  │ Custom Agents │ │
│  │  - Validation │  │ - Data analysis│  │ (Extensible)  │ │
│  └───────────────┘  └────────────────┘  └───────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      Subagent Layer                          │
│  ┌───────────────┐ ┌───────────────┐ ┌──────────────────┐  │
│  │Wallet Manager │ │TX Builder     │ │  Gas Optimizer   │  │
│  │- Key mgmt     │ │- TX construction│ │ - Price prediction│ │
│  │- Signing      │ │- Validation   │ │ - Network selection│ │
│  └───────────────┘ └───────────────┘ └──────────────────┘  │
│  ┌───────────────┐ ┢───────────────┐ ┌──────────────────┐  │
│  │Contract Analyzer│ │Event Monitor  │ │  State Manager   │  │
│  │- ABI parsing  │ │- Event watching│ │ - Cache mgmt     │  │
│  │- Security scan│ │- Notifications │ │ - Sync logic     │  │
│  └───────────────┘ └───────────────┘ └──────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  MCP Server Layer (Critical)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Ethereum MCP Server                     │  │
│  │  Resources: accounts, contracts, transactions        │  │
│  │  Tools: query, execute, deploy                       │  │
│  │  Prompts: contract_help, gas_estimate                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Solana MCP Server                      │  │
│  │  Resources: wallets, programs, accounts              │  │
│  │  Tools: query, send_tx, deploy_program               │  │
│  │  Prompts: program_help, rent_estimate                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Multi-Chain MCP Server                    │  │
│  │  Resources: unified_accounts, cross_chain_txs        │  │
│  │  Tools: bridge, aggregate_balance, route_tx          │  │
│  │  Prompts: best_chain, cheapest_route                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Blockchain Integration Layer                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Ethers.js   │  │ Solana Web3  │  │      Viem       │  │
│  │    (v6)      │  │     (v1)     │  │  (Type-safe)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                    │            │
│  ┌──────▼─────────────────▼────────────────────▼────────┐  │
│  │           RPC Provider Abstraction Layer             │  │
│  │  - Load balancing                                    │  │
│  │  - Failover (Alchemy → Infura → QuickNode)         │  │
│  │  - Rate limiting                                     │  │
│  │  - Request caching                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Ethereum │ │  Solana  │ │  Polygon │ │ Other Chains │  │
│  │ Mainnet  │ │ Mainnet  │ │ Mainnet  │ │  (Future)    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. Separation of Concerns

**Layers**:
- **Presentation**: Slash commands, skills
- **Application**: Agents, subagents
- **Integration**: MCP servers
- **Infrastructure**: Blockchain libraries

**Benefits**:
- Easy to test individual components
- Can replace layers without affecting others
- Clear boundaries reduce complexity

### 2. Agent-Based Architecture

**Hierarchical Structure**:

```
Orchestrator Agent (CEO)
    ├── Blockchain Agent (CTO)
    │   ├── Wallet Manager Subagent
    │   ├── TX Builder Subagent
    │   └── Gas Optimizer Subagent
    ├── DeFi Agent (CFO)
    │   ├── DEX Subagent
    │   ├── Lending Subagent
    │   └── Staking Subagent
    ├── NFT Agent (Creative Director)
    │   ├── Minting Subagent
    │   ├── Marketplace Subagent
    │   └── Metadata Subagent
    ├── Security Agent (CISO)
    │   ├── TX Validator Subagent
    │   ├── Contract Scanner Subagent
    │   └── Risk Assessor Subagent
    └── Analytics Agent (Data Scientist)
        ├── Price Feed Subagent
        ├── Portfolio Tracker Subagent
        └── Report Generator Subagent
```

**Communication Pattern**: Orchestrator coordinates all agents using message passing

### 3. MCP-First Design

All blockchain access goes through MCP servers:

```typescript
// NOT THIS (direct blockchain access)
const balance = await ethersProvider.getBalance(address);

// THIS (through MCP)
const balance = await mcpClient.callTool({
  name: "ethereum:get_balance",
  arguments: { address }
});
```

**Benefits**:
- Standardized interface
- Easier to mock for testing
- Logging and monitoring built-in
- Security layer at MCP boundary

### 4. Fail-Safe Defaults

```typescript
// Always assume failure, plan for recovery
try {
  const tx = await sendTransaction(params);
  return tx;
} catch (error) {
  await logError(error);
  await notifyUser(error);
  // DO NOT retry automatically for financial transactions
  throw new SafeTransactionError(error);
}
```

### 5. Type Safety Throughout

```typescript
// Strong typing at every layer
interface TransactionRequest {
  to: Address; // Type alias, not string
  value: bigint; // Not number
  data?: Hex; // Type-checked hex string
  gasLimit?: bigint;
}

// Runtime validation with Zod
const TransactionRequestSchema = z.object({
  to: AddressSchema,
  value: BigIntSchema,
  data: HexSchema.optional(),
  gasLimit: BigIntSchema.optional(),
});
```

## Component Details

### MCP Servers

#### Ethereum MCP Server

**File**: `src/mcp-servers/ethereum/index.ts`

**Resources** (Read-only data):
```typescript
{
  "accounts": "list://ethereum/accounts",
  "contracts": "list://ethereum/contracts/{address}",
  "transactions": "list://ethereum/transactions/{hash}",
  "blocks": "list://ethereum/blocks/{number}"
}
```

**Tools** (Actions):
```typescript
{
  "query_balance": { address, token? },
  "get_transaction": { hash },
  "send_transaction": { to, value, data, gasLimit },
  "deploy_contract": { bytecode, abi, constructorArgs },
  "call_contract": { address, method, args },
  "estimate_gas": { to, value, data }
}
```

**Prompts** (Templates):
```typescript
{
  "contract_help": "How to interact with contract at {address}",
  "gas_estimation": "Estimate gas for {operation}",
  "error_diagnosis": "Diagnose transaction error {hash}"
}
```

#### Solana MCP Server

**File**: `src/mcp-servers/solana/index.ts`

**Resources**:
```typescript
{
  "wallets": "list://solana/wallets",
  "programs": "list://solana/programs/{address}",
  "accounts": "list://solana/accounts/{address}",
  "transactions": "list://solana/transactions/{signature}"
}
```

**Tools**:
```typescript
{
  "get_balance": { publicKey },
  "get_account_info": { publicKey },
  "send_transaction": { instructions, signers },
  "deploy_program": { programData },
  "get_program_accounts": { programId, filters },
  "request_airdrop": { publicKey, lamports } // Devnet only
}
```

#### Multi-Chain MCP Server

**File**: `src/mcp-servers/multi-chain/index.ts`

**Purpose**: Aggregate multiple chains, routing, bridging

**Tools**:
```typescript
{
  "get_total_balance": { address, chains },
  "best_chain_for_tx": { operation, amount },
  "bridge_tokens": { from_chain, to_chain, token, amount },
  "gas_comparison": { chains, operation }
}
```

### Agent System

#### Base Agent Class

**File**: `src/agents/BaseAgent.ts`

```typescript
abstract class BaseAgent {
  protected name: string;
  protected description: string;
  protected mcpClient: MCPClient;
  protected subagents: Map<string, Subagent>;

  abstract async plan(task: Task): Promise<TaskPlan>;
  abstract async execute(plan: TaskPlan): Promise<Result>;
  abstract async validate(result: Result): Promise<boolean>;

  protected async delegate(subtask: SubTask, subagent: string): Promise<Result> {
    // Delegation logic
  }

  protected async communicate(agent: string, message: Message): Promise<Response> {
    // Inter-agent communication
  }
}
```

#### Orchestrator Agent

**Responsibilities**:
1. Receive high-level tasks from users
2. Decompose into subtasks
3. Determine which agents to involve
4. Coordinate execution
5. Aggregate results
6. Handle failures

**Example Flow**:
```
User: "Swap 1 ETH for USDC on the cheapest DEX"

Orchestrator:
  1. Task decomposition:
     - Get current ETH price
     - Find available DEXes
     - Get quotes from each
     - Select cheapest
     - Execute swap

  2. Agent assignment:
     - Analytics Agent: price feeds
     - DeFi Agent: DEX operations
     - Security Agent: validate transaction

  3. Execution:
     - Parallel: Get price + Get DEX quotes
     - Sequential: Validate → Execute swap

  4. Result: Transaction hash + confirmation
```

#### Specialized Agents

**Blockchain Agent** (`src/agents/BlockchainAgent.ts`):
- General blockchain operations
- Transaction management
- Balance queries
- Block exploration

**DeFi Agent** (`src/agents/DeFiAgent.ts`):
- DEX swaps (Uniswap, SushiSwap, etc.)
- Lending/borrowing (Aave, Compound)
- Staking operations
- Yield farming

**NFT Agent** (`src/agents/NFTAgent.ts`):
- NFT minting
- Marketplace operations (OpenSea, etc.)
- Metadata management
- Rarity analysis

**Security Agent** (`src/agents/SecurityAgent.ts`):
- Transaction validation
- Contract security scanning
- Risk assessment
- Anomaly detection

**Analytics Agent** (`src/agents/AnalyticsAgent.ts`):
- Price feeds
- Portfolio tracking
- Performance analysis
- Report generation

### Subagent System

#### Wallet Manager Subagent

**File**: `src/subagents/WalletManager.ts`

**Responsibilities**:
- Secure key storage
- Transaction signing
- Address derivation
- Multi-sig coordination

**Security**:
- Keys never leave the subagent
- All operations logged
- Rate limiting on signing
- User confirmation for high-value TXs

#### Transaction Builder Subagent

**File**: `src/subagents/TransactionBuilder.ts`

**Responsibilities**:
- Construct raw transactions
- ABI encoding
- Gas estimation
- Nonce management

#### Gas Optimizer Subagent

**File**: `src/subagents/GasOptimizer.ts`

**Responsibilities**:
- Monitor gas prices
- Predict optimal gas price
- Network selection (Layer 2 vs mainnet)
- Transaction batching

## Data Flow Examples

### Example 1: Simple Balance Query

```
User → Slash Command (/balance 0x123)
  ↓
Orchestrator Agent
  ↓
Blockchain Agent
  ↓
Ethereum MCP Server (query_balance tool)
  ↓
Ethers.js → RPC Provider → Ethereum Network
  ↓
Result: 1.5 ETH
  ↓
Blockchain Agent → Orchestrator → User
```

### Example 2: Complex DeFi Swap

```
User → "Swap 1 ETH for USDC, best price"
  ↓
Orchestrator Agent (task decomposition)
  ├──→ Analytics Agent (get ETH price)
  │    └─→ Multi-Chain MCP (price feeds)
  │         └─→ Result: $2500
  ├──→ DeFi Agent (get DEX quotes)
  │    ├─→ Query Uniswap via Ethereum MCP
  │    ├─→ Query SushiSwap via Ethereum MCP
  │    └─→ Select best: Uniswap ($2510)
  └──→ Security Agent (validate)
       ├─→ Check contract security
       ├─→ Simulate transaction
       └─→ Approve ✓
  ↓
DeFi Agent (execute swap)
  ├──→ Wallet Manager (sign TX)
  ├──→ Gas Optimizer (optimize gas)
  └──→ TX Builder (construct TX)
       └──→ Ethereum MCP (send_transaction)
            └──→ Result: TX hash 0xabc...
  ↓
Orchestrator → User: "Swapped successfully, TX: 0xabc..."
```

## Configuration Management

### Environment-Based Config

```typescript
// config/index.ts
export const config = {
  networks: {
    ethereum: {
      mainnet: process.env.ETH_MAINNET_RPC,
      sepolia: process.env.ETH_SEPOLIA_RPC,
    },
    solana: {
      mainnet: process.env.SOL_MAINNET_RPC,
      devnet: process.env.SOL_DEVNET_RPC,
    },
  },
  mcp: {
    ethereum: {
      port: 3001,
      enabled: true,
    },
    solana: {
      port: 3002,
      enabled: true,
    },
  },
  agents: {
    orchestrator: { enabled: true },
    blockchain: { enabled: true },
    defi: { enabled: true },
    nft: { enabled: true },
    security: { enabled: true },
    analytics: { enabled: true },
  },
};
```

## Error Handling Strategy

### Error Hierarchy

```typescript
class FrameworkError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
  }
}

class MCPError extends FrameworkError {}
class AgentError extends FrameworkError {}
class BlockchainError extends FrameworkError {
  constructor(message: string, public txHash?: string, public revertReason?: string) {
    super(message, 'BLOCKCHAIN_ERROR');
  }
}
class SecurityError extends FrameworkError {} // NEVER catch these
```

### Error Recovery

1. **Transient Errors** (network issues): Retry with exponential backoff
2. **User Errors** (invalid input): Return clear error message
3. **System Errors** (bugs): Log, alert, fail gracefully
4. **Security Errors**: Halt immediately, no recovery

## Performance Considerations

### Caching Strategy

```typescript
// Cache blockchain data with appropriate TTLs
const CACHE_TTL = {
  balance: 30_000, // 30 seconds
  transaction: Infinity, // Never expires
  blockNumber: 12_000, // 12 seconds (1 block)
  gasPrice: 15_000, // 15 seconds
  contractCode: Infinity, // Never changes
};
```

### Rate Limiting

```typescript
// Respect RPC provider limits
const RATE_LIMITS = {
  alchemy: { requestsPerSecond: 25 },
  infura: { requestsPerSecond: 10 },
  quicknode: { requestsPerSecond: 15 },
};
```

### Parallel Execution

```typescript
// Execute independent operations in parallel
const [balance, nonce, gasPrice] = await Promise.all([
  getBalance(address),
  getNonce(address),
  getGasPrice(),
]);
```

## Security Architecture

### Defense in Depth

1. **Input Validation** (Zod schemas)
2. **MCP Boundary** (Tool authorization)
3. **Agent Validation** (Security agent approval)
4. **Subagent Security** (Wallet manager signing rules)
5. **Blockchain Validation** (Smart contract checks)

### Principle of Least Privilege

- Agents only access MCPs they need
- Subagents only expose minimal interface
- Users only access safe slash commands

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Status**: Approved for Implementation
