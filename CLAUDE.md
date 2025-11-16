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

## Real-World Deployment Gotchas ⚠️ CRITICAL

**Source**: Production analysis of 456 commits from zmartV0.69 and kektechV0.69

These issues cost real projects 40% of development time. **Read before deployment**:

### Deployment Issues

1. **Vercel Monorepo**: ALWAYS set `rootDirectory` in `vercel.json`
   - **Cost**: 18 hours debugging if you don't
   - **Fix**: `{"rootDirectory": "frontend", "installCommand": "cd ../.. && pnpm install"}`
   - **See**: Guide 17, Section 1.1

2. **PM2 Crashes**: Check compiled files exist BEFORE blaming code
   - **Symptom**: PM2 shows "online" but restarts every 5 seconds
   - **Cost**: Production down for hours (INCIDENT-001: 47 restarts in 4 minutes)
   - **Fix**: Run `test -f dist/index.js || npm run build` before `pm2 start`
   - **See**: Guide 04, Section 9.3

3. **Mixed Content**: Use HTTPS for ALL production APIs
   - **Problem**: Frontend HTTPS + Backend HTTP = blocked by browser
   - **Cost**: 6 commits, multiple hours debugging
   - **Fix**: Cloudflare Tunnel for backend HTTPS
   - **See**: Guide 17, Section 2.4

### Integration Issues

4. **API Parameters**: Share TypeScript types between frontend/backend
   - **Cost**: 40+ commits fixing parameter mismatches if you don't
   - **Example**: `address` vs `walletAddress` causing silent failures
   - **Fix**: Use `packages/shared/` with Zod validation
   - **See**: Guide 18, Section 1.1

5. **Environment Variables**: Validate on startup, watch for newlines
   - **Problem**: Invisible `\n` in `.env` breaks API URLs silently
   - **Cost**: 3 commits, hours of debugging
   - **Fix**: Run `cat .env | od -c` to detect, use validation script
   - **See**: Guide 17, Section 1.2.4

6. **Database Migrations**: Run BEFORE deployment, not after
   - **Problem**: Schema drift causes production crashes
   - **Cost**: Services crash on startup
   - **Fix**: `npx prisma migrate deploy` before deploying code
   - **See**: Guide 18, Section 2.2

### Build & Compilation

7. **Prisma in Vercel**: Use lazy initialization
   - **Problem**: `DATABASE_URL` not available at build time
   - **Cost**: Multiple commits fixing initialization
   - **Fix**: `getPrisma()` function instead of `new PrismaClient()`
   - **See**: Guide 17, Section 1.3.1

8. **TypeScript Strict**: Migrate incrementally, not all at once
   - **Problem**: Flipping strict mode creates 70+ errors instantly
   - **Cost**: Days of work fixing type errors
   - **Fix**: Enable strict checks gradually per-file
   - **See**: kektechV0.69 commit `1b910b2`

### Runtime Issues

9. **WebSocket Lifecycle**: Proper cleanup prevents memory leaks
   - **Problem**: Event listeners not removed on disconnect
   - **Fix**: `ws.removeAllListeners()` + process exit handlers
   - **See**: Guide 04, Section 7.1

10. **Health Checks**: Add to ALL services
    - **Purpose**: How you detect PM2 crash loops early
    - **Fix**: `/health` endpoint + `pm2 status` monitoring
    - **See**: Guide 17, Section 2.5

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
