# Blockchain Web3 Specialist Framework

## Tech Stack

- **Runtime**: Node.js 18+, TypeScript 5.3+ (strict mode)
- **Blockchain**: Ethers.js v6 (Ethereum), @solana/web3.js (Solana)
- **MCP**: @modelcontextprotocol/sdk
- **Testing**: Vitest (80%+ coverage required)
- **Package Manager**: pnpm (DO NOT use npm or yarn)

## Critical Commands

### Development

```bash
# Install dependencies
pnpm install

# Type check (ALWAYS run before committing)
pnpm typecheck

# Lint (MUST pass)
pnpm lint

# Test (MUST have 80%+ coverage)
pnpm test --coverage

# Build
pnpm build
```

### Testing Blockchain

```bash
# Start Hardhat node (Ethereum testing)
pnpm hardhat node

# Start Solana test validator
solana-test-validator

# Run integration tests (requires local nodes)
pnpm test:integration
```

## Code Style Guidelines

- **NEVER** use `any` type - always provide proper types
- **ALWAYS** validate inputs with Zod schemas
- **ALWAYS** use `readonly` for arrays/objects that shouldn't mutate
- **NEVER** commit `.env` files or private keys
- **ALWAYS** wipe private keys from memory after use
- **USE** `logger` not `console.log` in production code

## Security Critical Rules

⚠️ **PRIVATE KEYS**:
- NEVER log private keys
- ALWAYS encrypt before storage (AES-256-GCM)
- ALWAYS wipe from memory after signing
- 100% test coverage required for wallet code

⚠️ **TRANSACTIONS**:
- ALWAYS simulate before executing (Tenderly)
- NEVER test on mainnet
- ALWAYS use testnets (Sepolia, Solana Devnet)
- ALWAYS validate gas prices (max 500 gwei)

## Project Structure

```
src/
├── agents/          # AI agents (Orchestrator, DeFi, NFT, etc.)
├── subagents/       # Specialized subagents (Wallet, TX Builder, etc.)
├── mcp-servers/     # MCP servers (ethereum, solana, multi-chain)
├── skills/          # (NOT HERE - in .claude/skills/)
├── utils/           # Utilities
└── types/           # Type definitions

.claude/
├── commands/        # Slash commands
└── skills/          # Claude Code skills

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests (requires local nodes)
└── e2e/             # End-to-end tests
```

## Common Gotchas

1. **Nonce Management**: ALWAYS use NonceManager for concurrent transactions
2. **Solana vs Ethereum**: Different address formats (Base58 vs Hex)
3. **Lamports vs Wei**: Solana uses 10^9, Ethereum uses 10^18
4. **Gas Estimation**: Add 20% buffer to estimates
5. **Chain Reorgs**: Wait for 12+ confirmations on Ethereum

## Recent Changes

- 2025-11-14: **CRITICAL**: Added comprehensive edge case analysis (40+ edge cases)
- 2025-11-14: Added edge case implementation checklist (Guide 16)
- 2025-11-14: Added complete implementation guides (02-15)
- 2025-11-14: Created MCP server architecture
- 2025-11-14: Documented all corruption scenarios
- 2025-11-14: Added optimization recommendations based on official best practices

## Edge Cases ⚠️ CRITICAL

**MUST READ before production**: `docs/risks/04-comprehensive-edge-cases.md`

Common edge cases you WILL encounter:
1. **Nonce collisions** in concurrent transactions → Use NonceManager with Redis
2. **Blockhash expiration** on Solana (~79 seconds) → Refresh blockhash, use durable nonces
3. **Chain reorgs** (12+ blocks on Ethereum) → Wait for deep confirmations
4. **RPC rate limiting** (5-10 req/sec) → Use Bottleneck + multi-provider failover
5. **Gas price spikes** (>500 gwei) → Enforce ceiling, add warnings
6. **MEV sandwich attacks** ($289M in 2024) → Flashbots + slippage protection
7. **Oracle manipulation** (>$100M stolen) → Use Chainlink + TWAP
8. **Reentrancy** ($47M in 2024) → NonReentrant guards
9. **Private key compromise** ($449M in 2024) → Multi-sig + hardware wallets
10. **WebSocket leaks** → Proper cleanup + lifecycle management

See `docs/implementation/16-edge-case-checklist.md` for implementation checklist.

## Development Workflow

1. **Explore**: Read relevant files first (DON'T code yet)
2. **Plan**: Create task plan with `/plan` or "ultrathink"
3. **Test**: Write tests FIRST (TDD)
4. **Code**: Implement to pass tests
5. **Validate**: Run typecheck + lint + test
6. **Commit**: Only commit working code

## Need Help?

- Architecture: `docs/architecture/01-system-architecture.md`
- Implementation: `docs/implementation/` (guides 00-16)
- **Edge Cases**: `docs/risks/04-comprehensive-edge-cases.md` ⚠️ **READ THIS**
- **Edge Case Checklist**: `docs/implementation/16-edge-case-checklist.md`
- Security: `docs/risks/03-corruption-scenarios.md`
- Testing: `docs/testing/01-testing-strategy.md`
- Optimization: `docs/optimization/OPTIMIZATION_RECOMMENDATIONS.md`
