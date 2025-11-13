# Blockchain Web3 Specialist Framework

## Project Overview

This is a comprehensive Web3 debugging and development framework designed for solo developers working on complex multi-chain applications with intricate frontend-backend-blockchain integrations.

## Technology Stack

### Blockchain Networks
- **EVM Chains:** Ethereum, Polygon, BSC, Arbitrum, Optimism, etc.
- **Solana:** Mainnet, Devnet, Testnet
- **RPC Providers:** Helius (primary), configurable for Alchemy, Infura, QuickNode

### Smart Contracts

#### EVM
- **Development:** Hardhat, Foundry
- **Language:** Solidity (0.8.x)
- **Libraries:** OpenZeppelin Contracts
- **Testing:** Foundry (forge), Hardhat (Mocha/Chai)
- **Security:** Slither, Mythril

#### Solana
- **Framework:** Anchor
- **Language:** Rust
- **Testing:** Anchor test suite
- **CLI:** Solana CLI, Anchor CLI

### Frontend
- **Framework:** Next.js / React
- **Deployment:** Vercel
- **Styling:** TailwindCSS (typical)
- **Web3 Libraries:**
  - **EVM:** ethers.js, wagmi, viem
  - **Solana:** @solana/web3.js, @solana/wallet-adapter-react

### Backend
- **Database:** Supabase (PostgreSQL)
- **Cache:** Upstash Redis
- **API:** Next.js API routes / Supabase Edge Functions
- **Authentication:** Supabase Auth

### Development Tools
- **Package Manager:** npm / pnpm / yarn
- **Version Control:** Git + GitHub
- **CI/CD:** GitHub Actions
- **Code Quality:** ESLint, Prettier, TypeScript
- **Testing:** Jest, Vitest, Playwright

## Architecture Patterns

### Multi-Layer Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                     │
│  Next.js + React + TailwindCSS                          │
│  ├─ EVM: wagmi + viem                                   │
│  └─ Solana: @solana/web3.js + wallet-adapter           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├─────────────┬─────────────────────────┐
                  │             │                         │
         ┌────────▼──────┐  ┌──▼──────────┐  ┌──────────▼────────┐
         │  BACKEND API  │  │  SUPABASE   │  │  UPSTASH REDIS   │
         │  (Next.js)    │  │  (Database) │  │  (Cache)         │
         └────────┬──────┘  └──┬──────────┘  └──────────┬────────┘
                  │             │                         │
                  └─────────────┴─────────────────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  │                           │
         ┌────────▼──────────┐    ┌──────────▼─────────┐
         │  EVM BLOCKCHAINS  │    │  SOLANA BLOCKCHAIN │
         │  (via Helius)     │    │  (via Helius)      │
         └───────────────────┘    └────────────────────┘
```

### Common Integration Patterns

#### Pattern 1: Wallet Connection
```typescript
// EVM (wagmi)
const { connect } = useConnect()
const { address } = useAccount()

// Solana
const { publicKey } = useWallet()
```

#### Pattern 2: Transaction Signing
```typescript
// EVM
const { write } = useContractWrite({ ... })

// Solana
const transaction = new Transaction()
const signature = await wallet.sendTransaction(transaction, connection)
```

#### Pattern 3: State Synchronization
```
User Action (Frontend)
  ↓
Sign Transaction (Wallet)
  ↓
Submit to Blockchain (RPC)
  ↓
Wait for Confirmation
  ↓
Update Backend (Supabase)
  ↓
Invalidate Cache (Redis)
  ↓
Update Frontend State
```

## Common Integration Bug Categories

### 1. Frontend-Blockchain Sync Issues
- **Symptoms:** UI shows wrong balances, transactions not appearing, stale data
- **Root Causes:**
  - Missing event listeners for blockchain state changes
  - Cache not invalidated after transactions
  - Race conditions between blockchain and database updates
  - Network switching not handled properly

### 2. Backend-Blockchain Mismatch
- **Symptoms:** Backend has different data than blockchain, double-spending, missing transactions
- **Root Causes:**
  - Transaction confirmation not awaited
  - Blockchain reorganizations not handled
  - Event indexing gaps
  - RPC provider rate limits causing missed events

### 3. Wallet Integration Problems
- **Symptoms:** Connection failures, transaction rejections, wrong network
- **Root Causes:**
  - Multiple wallet adapters conflicting
  - Network mismatch (frontend vs backend)
  - Missing wallet permissions
  - Wallet state not persisted correctly

### 4. API-Database-Cache Inconsistency
- **Symptoms:** Stale data, cache misses, database queries slow
- **Root Causes:**
  - Cache invalidation logic incorrect
  - Database migrations not applied
  - Connection pool exhaustion
  - Race conditions in concurrent requests

### 5. Configuration Drift (Local vs Production)
- **Symptoms:** Works locally, fails on Vercel, wrong RPC endpoints
- **Root Causes:**
  - Environment variables not set correctly
  - Different RPC providers between environments
  - Network IDs hardcoded
  - CORS issues in production

### 6. Multi-Chain State Management
- **Symptoms:** Wrong chain data displayed, transactions sent to wrong network
- **Root Causes:**
  - Chain ID not checked before transactions
  - State not scoped by network
  - RPC provider returns data from wrong chain
  - Wallet network doesn't match app network

## Debugging Workflow

### When Integration Bugs Occur

1. **Identify the Layer:**
   - Is it frontend state?
   - Is it backend/database?
   - Is it blockchain/RPC?
   - Is it caching?
   - Is it wallet/signing?

2. **Check the Flow:**
   - User action → Wallet → RPC → Blockchain → Backend → Cache → Frontend
   - Where does the flow break?

3. **Verify Synchronization:**
   - Is frontend in sync with blockchain?
   - Is backend in sync with blockchain?
   - Is cache valid?
   - Are all events being captured?

4. **Examine Configuration:**
   - Are RPC endpoints correct?
   - Are network IDs matching?
   - Are environment variables set?
   - Are API keys valid?

## Development Guidelines

### Code Quality Standards
- **TypeScript:** Strict mode enabled, no `any` types
- **Testing:** >90% coverage for critical paths
- **Security:** All contracts audited before mainnet
- **Documentation:** All public APIs documented

### Git Workflow
- **Branch naming:** `feature/`, `fix/`, `refactor/`
- **Commits:** Conventional commits format
- **PRs:** Required for all changes
- **Reviews:** Automated (CodeRabbit) + manual

### Deployment Process

#### Smart Contracts
1. Test locally (Foundry/Anvil, Anchor localnet)
2. Deploy to testnet
3. Verify on block explorer
4. Audit if critical
5. Deploy to mainnet
6. Monitor with Tenderly/Helius webhooks

#### Frontend/Backend
1. Test locally
2. Create Vercel preview deployment
3. Test on preview
4. Merge to main → auto-deploy to production
5. Monitor with Sentry, Vercel Analytics

## Critical Files & Directories

```
project-root/
├── contracts/           # Smart contracts (EVM: Solidity, Solana: Rust)
│   ├── evm/
│   └── solana/
├── frontend/           # Next.js application
│   ├── components/
│   ├── hooks/         # Web3 integration hooks
│   ├── lib/           # Utilities, API clients
│   └── pages/
├── backend/            # API routes, Supabase functions
│   ├── api/
│   └── functions/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.local          # Local environment variables
├── .env.production     # Production environment variables
├── hardhat.config.ts   # Hardhat configuration (EVM)
├── foundry.toml        # Foundry configuration (EVM)
├── Anchor.toml         # Anchor configuration (Solana)
└── vercel.json         # Vercel deployment config
```

## Environment Variables

### Required for Development
```bash
# RPC Providers (Helius)
NEXT_PUBLIC_HELIUS_API_KEY=your_api_key
NEXT_PUBLIC_EVM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
NEXT_PUBLIC_SOLANA_RPC_URL=https://rpc.helius.xyz/?api-key=your_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Upstash Redis
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=1 # Ethereum mainnet
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Development
NODE_ENV=development
```

## Best Practices for Complex Integration Debugging

### 1. Always Use Transaction Receipts
```typescript
// Bad
await contract.transfer(to, amount)

// Good
const tx = await contract.transfer(to, amount)
const receipt = await tx.wait()
console.log('Block:', receipt.blockNumber)
```

### 2. Handle Network Switching
```typescript
const { chain } = useNetwork()
const { switchNetwork } = useSwitchNetwork()

useEffect(() => {
  if (chain?.id !== requiredChainId) {
    switchNetwork?.(requiredChainId)
  }
}, [chain])
```

### 3. Cache Invalidation Strategy
```typescript
// After blockchain transaction
const receipt = await tx.wait()

// Invalidate cache
await redis.del(`balance:${address}`)

// Update database
await supabase.from('transactions').insert({ ... })

// Refetch frontend state
queryClient.invalidateQueries(['balance', address])
```

### 4. Error Handling at Every Layer
```typescript
try {
  const tx = await contract.method()
  const receipt = await tx.wait()

  // Update backend
  const { error } = await supabase.from('txs').insert(...)
  if (error) throw error

} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    // Handle specific error
  }
  // Log to Sentry
  // Show user-friendly message
}
```

## Framework Debugging Tool Integration

This project uses the Web3 Debugging Framework with:
- **Interactive Questions:** Human verification at critical checkpoints
- **Multi-Tool Validation:** CodeRabbit, Slither, ESLint, TypeScript
- **Automatic Fix Suggestions:** With dry-run mode and user confirmation
- **Rollback System:** Git-based with snapshots for safety
- **Multi-Chain Support:** Unified debugging for EVM and Solana

### Invoking the Debugger
```bash
# Via skill (recommended)
Use /debug command in Claude Code

# The debugger will:
1. Ask clarifying questions about the issue
2. Analyze the full stack (frontend, backend, blockchain)
3. Present findings with priority
4. Ask for confirmation before fixes
5. Apply fixes with verification at each step
6. Provide rollback if needed
```

## Notes for AI Assistants

When helping debug this project:
1. **Always ask which layer** the issue is in (frontend, backend, blockchain, integration)
2. **Check network configuration** (local, testnet, mainnet)
3. **Verify RPC connectivity** before assuming blockchain issues
4. **Check cache state** - many "bugs" are stale cache
5. **Examine the full flow** - integration bugs are rarely single-layer
6. **Use Context7** for up-to-date library documentation
7. **Run CodeRabbit** for automated code review
8. **Never assume** - always ask for confirmation before making changes

---

**Last Updated:** 2025-11-13
**Maintained By:** Solo developer
**Primary Focus:** Complex multi-layer Web3 integration debugging
