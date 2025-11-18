# Production Readiness Implementation Plan

**Status**: In Progress
**Start Date**: 2025-11-18
**Estimated Completion**: 112-170 hours
**Branch**: `claude/investigate-toon-format-01GzHyjLQ12U58iTbd7Q7Dmr`

## Overview

This document tracks the implementation of 7 critical production-readiness features identified during framework review.

## Implementation Phases

### Phase 1: Foundation Layer (16-24 hours)
**Goal**: Core infrastructure for performance, safety, and reliability

1. ✅ **p-limit for Concurrency Control** (30 min, medium value)
   - Add dependency: `p-limit`
   - Update `WorkflowEngine.executeParallel()` to limit concurrent steps
   - Configurable via `maxConcurrentSteps` parameter
   - Test with 100+ parallel steps

2. ⏳ **Rate Limiting with Bottleneck** (4-6 hrs, medium value)
   - Add dependency: `bottleneck`
   - Create `RateLimiter` utility class
   - Integrate with MCP servers (Ethereum, Solana, Multi-chain)
   - Respect documented limits:
     - Alchemy: 25 req/sec
     - Infura: 10 req/sec
     - QuickNode: 15 req/sec
   - Add tests for rate limit enforcement

3. ⏳ **Caching Layer** (8-12 hrs, high value)
   - Add dependency: `node-cache`
   - Create `CacheManager` class
   - Implement documented TTLs:
     - Balance: 30s
     - Transaction: Infinity (immutable)
     - Block number: 12s
     - Gas price: 15s
   - Add LRU eviction
   - Integration with MCP servers
   - Cache invalidation strategies
   - Metrics: hit rate, miss rate, eviction count

4. ⏳ **Redis for Nonce Management** (12-16 hrs, critical value)
   - Add dependencies: `ioredis`, `@types/ioredis`
   - Create `RedisNonceManager` subagent
   - Features:
     - Distributed nonce tracking
     - Atomic increment operations
     - Nonce reservation for concurrent TX
     - Automatic cleanup of stale nonces
     - Fallback to local nonce tracking if Redis unavailable
   - Integration with `TransactionBuilder`
   - Comprehensive tests (concurrent scenarios)

### Phase 2: Safety Layer (16-20 hours)
**Goal**: Prevent costly transaction failures

5. ⏳ **Transaction Simulation with Tenderly** (16-20 hrs, high value)
   - Add dependency: `@tenderly/sdk`
   - Create `TransactionSimulator` subagent (already exists, enhance)
   - Features:
     - Pre-broadcast simulation
     - Gas estimation validation
     - Revert reason detection
     - State change analysis
     - Security checks (reentrancy, overflow)
   - Integration with Security Agent
   - Required for all mainnet transactions
   - Fallback to local simulation if Tenderly unavailable
   - Configuration:
     - `TENDERLY_API_KEY` (env var)
     - `TENDERLY_PROJECT` (env var)
     - `SIMULATION_REQUIRED` (default: true for mainnet)

### Phase 3: Monitoring Layer (12-16 hours)
**Goal**: Real-time event monitoring and faster responses

6. ⏳ **WebSocket Subscriptions** (12-16 hrs, high value)
   - Add dependencies: `ws`, `@types/ws`
   - Create `WebSocketManager` utility
   - Features:
     - Subscribe to pending transactions
     - Block headers (new blocks)
     - Contract events (filtered)
     - Connection lifecycle management
     - Automatic reconnection with exponential backoff
     - Heartbeat/ping-pong
   - Integration with Event Monitor subagent
   - Replace polling with push-based updates
   - Support both Ethereum (WSS) and Solana (WebSocket)

### Phase 4: Edge Case Hardening (60-80 hours)
**Goal**: Handle all documented edge cases

7. ⏳ **Edge Case Implementation** (60-80 hrs, critical value)

   **7.1 Nonce Collisions** (8-10 hrs)
   - Redis-backed nonce manager (from Phase 1)
   - Nonce gap detection and recovery
   - Concurrent transaction coordination
   - Tests: 10+ concurrent transactions

   **7.2 Blockhash Expiration (Solana)** (6-8 hrs)
   - Recent blockhash caching (max age: 60s)
   - Automatic refresh on expiration
   - Durable nonce support
   - Transaction retry with fresh blockhash

   **7.3 Chain Reorgs** (8-10 hrs)
   - Configurable confirmation depth (default: 12 for Ethereum)
   - Reorg detection via block hash chain
   - Transaction re-verification after reorg
   - User notification on reorg-affected TX

   **7.4 RPC Failover** (10-12 hrs)
   - Multi-provider configuration
   - Health check per provider
   - Automatic failover on error
   - Round-robin + weighted selection
   - Circuit breaker pattern
   - Provider priority: Alchemy → Infura → QuickNode → Public

   **7.5 Gas Price Spikes** (6-8 hrs)
   - Configurable max gas price (default: 500 gwei)
   - User warning on high gas
   - Transaction queuing until gas drops
   - Gas price trend analysis

   **7.6 MEV Sandwich Attacks** (10-12 hrs)
   - Flashbots integration (Ethereum)
   - Private transaction mempool
   - Slippage protection (configurable %)
   - MEV detection heuristics

   **7.7 RPC Rate Limiting** (covered in Phase 1)

   **7.8 Insufficient Funds** (4-6 hrs)
   - Pre-flight balance checks
   - Gas reservation calculation
   - Clear error messages with required amounts

   **7.9 Contract Reentrancy** (covered in Phase 2 - Tenderly simulation)

   **7.10 Additional Edge Cases** (8-10 hrs)
   - Network congestion handling
   - Mempool monitoring
   - EIP-1559 fee market dynamics
   - Solana compute unit limits
   - Token approval edge cases

## Dependencies to Add

```bash
# Phase 1
pnpm add p-limit
pnpm add bottleneck
pnpm add node-cache
pnpm add ioredis
pnpm add -D @types/ioredis

# Phase 2
pnpm add @tenderly/sdk

# Phase 3
pnpm add ws
pnpm add -D @types/ws

# Phase 4
pnpm add @flashbots/ethers-provider-bundle  # For MEV protection
```

## Configuration Updates

### Environment Variables (`.env.example`)

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Tenderly Configuration (Transaction Simulation)
TENDERLY_API_KEY=your_tenderly_api_key
TENDERLY_PROJECT=your_project_slug
TENDERLY_ACCOUNT=your_account_name
SIMULATION_REQUIRED=true  # Require simulation for mainnet TX

# RPC Providers (Ethereum)
ETH_MAINNET_RPC_ALCHEMY=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETH_MAINNET_RPC_INFURA=https://mainnet.infura.io/v3/YOUR_KEY
ETH_MAINNET_RPC_QUICKNODE=https://YOUR_ENDPOINT.quiknode.pro/YOUR_KEY
ETH_MAINNET_RPC_PUBLIC=https://eth.public-rpc.com

# RPC Providers (Solana)
SOL_MAINNET_RPC_QUICKNODE=https://YOUR_ENDPOINT.quiknode.pro/YOUR_KEY
SOL_MAINNET_RPC_ALCHEMY=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
SOL_MAINNET_RPC_PUBLIC=https://api.mainnet-beta.solana.com

# Rate Limits (requests per second)
RPC_RATE_LIMIT_ALCHEMY=25
RPC_RATE_LIMIT_INFURA=10
RPC_RATE_LIMIT_QUICKNODE=15
RPC_RATE_LIMIT_PUBLIC=5

# Safety Limits
MAX_GAS_PRICE_GWEI=500
MIN_CONFIRMATIONS_ETH=12
MIN_CONFIRMATIONS_SOLANA=32
MAX_SLIPPAGE_PERCENT=2.0

# Flashbots (MEV Protection)
FLASHBOTS_AUTH_KEY=your_flashbots_private_key
```

## Testing Strategy

### Unit Tests
- Each new class/module has dedicated test file
- Minimum 80% code coverage
- 100% coverage for security-critical code (nonce management, TX simulation)

### Integration Tests
- Multi-provider failover scenarios
- Concurrent transaction handling
- Cache consistency across operations
- Redis failure scenarios (fallback to local)

### E2E Tests
- Complete transaction flows (testnet)
- Simulated edge cases:
  - Network congestion
  - Provider failures
  - Gas price spikes
  - Nonce collisions

### Load Tests
- 100+ concurrent transactions
- Rate limit enforcement under load
- Cache performance at scale
- Redis throughput limits

## Success Criteria

### Performance Metrics
- [ ] Cache hit rate >70% for repeated queries
- [ ] RPC failover <500ms
- [ ] Nonce collision rate <0.1%
- [ ] Average response time <2s for queries
- [ ] Transaction simulation <5s

### Reliability Metrics
- [ ] Zero nonce collisions in concurrent TX tests
- [ ] 100% failover success rate
- [ ] WebSocket uptime >99.5%
- [ ] Redis availability >99.9%

### Safety Metrics
- [ ] 100% of mainnet TX simulated before broadcast
- [ ] Zero transactions exceeding max gas price
- [ ] 100% detection of insufficient funds pre-flight
- [ ] Zero reentrancy vulnerabilities in simulations

## Implementation Order

1. **Week 1** (Phase 1 - Foundation)
   - Day 1: p-limit, bottleneck setup, initial testing
   - Day 2-3: Caching layer implementation and integration
   - Day 4-5: Redis nonce manager implementation and testing

2. **Week 2** (Phase 2 - Safety)
   - Day 1-2: Tenderly SDK integration
   - Day 3-4: Transaction simulation implementation
   - Day 5: Testing and edge case validation

3. **Week 3** (Phase 3 - Monitoring)
   - Day 1-2: WebSocket manager implementation
   - Day 3-4: Event subscription integration
   - Day 5: Testing and reliability validation

4. **Week 4-5** (Phase 4 - Edge Cases)
   - Week 4: High-priority edge cases (nonce, RPC failover, gas spikes)
   - Week 5: Medium-priority edge cases (reorgs, MEV, additional cases)

5. **Week 6** (Testing & Documentation)
   - Comprehensive integration testing
   - Load testing
   - Documentation updates
   - Production deployment preparation

## Rollback Plan

Each phase is independently deployable. If issues arise:
- Phase 1: Can disable caching, use local nonce tracking
- Phase 2: Can disable simulation requirement (not recommended for mainnet)
- Phase 3: Can fall back to polling
- Phase 4: Individual edge case handlers can be feature-flagged

## Monitoring & Observability

### Metrics to Track
- Cache hit/miss rates
- RPC provider latency and error rates
- Nonce manager operations (get, increment, collisions)
- Transaction simulation results (success/failure/revert reasons)
- WebSocket connection status
- Edge case trigger counts

### Logging Levels
- ERROR: Critical failures requiring immediate attention
- WARN: Edge cases triggered, failovers, degraded performance
- INFO: Normal operations (TX sent, cache hits, provider switches)
- DEBUG: Detailed operation traces (disabled in production)

## Documentation Updates Required

- [ ] Update `CLAUDE.md` with new configuration requirements
- [ ] Add Redis setup to `docs/implementation/00-prerequisites.md`
- [ ] Document caching strategy in architecture docs
- [ ] Add Tenderly integration guide
- [ ] Update testing strategy with new edge case tests
- [ ] Create operations runbook for production deployment

---

**Last Updated**: 2025-11-18
**Next Review**: After Phase 1 completion
