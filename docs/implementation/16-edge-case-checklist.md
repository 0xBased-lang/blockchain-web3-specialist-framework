# Implementation Guide 16: Edge Case Handling Checklist

**Time Estimate**: Ongoing throughout implementation
**Prerequisites**: All guides 00-15
**Critical**: YES - Must be integrated into all components

---

## Overview

This guide provides actionable checklists for implementing edge case handling across the entire framework. Use this during implementation of each component to ensure comprehensive coverage.

**Based on**: 2024-2025 real-world incidents and best practices
**Reference**: `docs/risks/04-comprehensive-edge-cases.md` for detailed code examples

---

## Pre-Implementation Checklist

Before starting any implementation:

- [ ] Read `docs/risks/04-comprehensive-edge-cases.md` completely
- [ ] Identify which edge cases apply to your component
- [ ] Plan mitigation strategies for P0 and P1 edge cases
- [ ] Allocate 20-30% extra time for edge case handling
- [ ] Set up monitoring for critical edge cases

---

## Component-Specific Checklists

### MCP Server Implementation (Guides 02-04)

**Blockchain Transaction Edge Cases**:
- [ ] Implement chain reorg detection for all transaction confirmations
- [ ] Wait for safe confirmation counts (12+ for Ethereum, 128 for Polygon)
- [ ] Add reorg recovery logic to retry failed transactions
- [ ] Test reorg handling in forked testnet

**Gas Management**:
- [ ] Implement gas price ceiling (max 500 gwei)
- [ ] Add gas price spike detection and warnings
- [ ] Implement dynamic gas price adjustment (20% buffer)
- [ ] Create gas price monitoring alerts
- [ ] Test transaction replacement for stuck transactions

**Nonce Management**:
- [ ] Implement Redis-based nonce tracking
- [ ] Add nonce locking mechanism for concurrent transactions
- [ ] Create nonce sync routine (runs every 5 minutes)
- [ ] Implement nonce recovery for failed transactions
- [ ] Test 100+ concurrent transactions
- [ ] Add database persistence for nonce recovery

**MEV Protection** (if handling swaps):
- [ ] Integrate Flashbots Protect for sensitive transactions
- [ ] Implement maximum slippage protection (default 0.5%)
- [ ] Add sandwich attack detection
- [ ] Use private mempool for high-value transactions
- [ ] Test MEV protection in mainnet fork

**RPC Rate Limiting**:
- [ ] Implement Bottleneck rate limiter (5-10 req/sec for free tier)
- [ ] Add exponential backoff for 429 errors
- [ ] Implement multi-provider failover (3+ providers)
- [ ] Test rate limit handling with burst traffic
- [ ] Add request batching where possible

**MCP Server Resilience**:
- [ ] Implement auto-reconnection with exponential backoff
- [ ] Add circuit breaker for repeatedly failing services
- [ ] Implement graceful degradation (use cached data if available)
- [ ] Return errors in tool results, not as protocol errors
- [ ] Test server disconnection and recovery
- [ ] Add health check endpoints

**Input Validation**:
- [ ] Use Zod schemas for ALL inputs
- [ ] Validate address checksums
- [ ] Prevent integer overflow (check uint256 max)
- [ ] Prevent negative amounts
- [ ] Sanitize all user input (XSS prevention)
- [ ] Test with malicious inputs

**Solana-Specific** (Guide 03):
- [ ] Implement blockhash expiration handling
- [ ] Use consistent commitment levels ('confirmed' for most operations)
- [ ] Add blockhash refresh logic for expired transactions
- [ ] Implement durable nonces for offline signing
- [ ] Test commitment level mismatches
- [ ] Handle RPC pool desynchronization

---

### Agent Implementation (Guides 05-06)

**Agent Coordination**:
- [ ] Implement message queue for agent communication
- [ ] Add conflict resolution for competing agents
- [ ] Prevent circular dependencies between agents
- [ ] Implement agent health checks
- [ ] Test agent deadlock scenarios
- [ ] Add timeout for agent responses (30 seconds default)

**State Management**:
- [ ] Implement atomic state updates
- [ ] Add optimistic locking for concurrent updates
- [ ] Create state recovery mechanism
- [ ] Test race conditions
- [ ] Add state snapshots for rollback

**Error Propagation**:
- [ ] Implement structured error responses
- [ ] Add error context for debugging
- [ ] Create error recovery strategies
- [ ] Test cascading failures
- [ ] Add circuit breakers between agents

---

### Subagent Implementation (Guides 07-10)

**Wallet Manager** (Guide 07):
- [ ] **CRITICAL**: Encrypt ALL private keys (AES-256-GCM)
- [ ] **CRITICAL**: Wipe keys from memory after use
- [ ] **CRITICAL**: 100% test coverage required
- [ ] Never log private keys
- [ ] Implement multi-signature for high-value wallets
- [ ] Use hardware wallets for production
- [ ] Implement two-tier wallet system (hot/cold)
- [ ] Test key encryption/decryption
- [ ] Test memory wiping
- [ ] Add key rotation mechanism

**Transaction Builder** (Guide 08):
- [ ] Implement transaction simulation before sending
- [ ] Add transaction validation (balance checks, gas estimation)
- [ ] Implement nonce management integration
- [ ] Add transaction queue for ordering
- [ ] Test transaction edge cases (insufficient balance, invalid recipient)
- [ ] Implement transaction replacement logic

**Gas Optimizer** (Guide 09):
- [ ] Implement gas estimation with 20% buffer
- [ ] Add EIP-1559 support (maxFeePerGas, maxPriorityFeePerGas)
- [ ] Create gas price monitoring
- [ ] Add gas optimization suggestions
- [ ] Test gas estimation accuracy
- [ ] Implement legacy gas price fallback

**Contract Analyzer** (Guide 10):
- [ ] Integrate Slither for static analysis
- [ ] Implement custom vulnerability checks:
  - [ ] Reentrancy detection
  - [ ] Integer overflow/underflow
  - [ ] Unchecked external calls
  - [ ] tx.origin authentication
  - [ ] Delegatecall to untrusted
  - [ ] Timestamp dependencies
- [ ] Add security scoring system
- [ ] Test with known vulnerable contracts
- [ ] Generate actionable security reports

---

### DeFi Operations

**Oracle Usage**:
- [ ] Use Chainlink decentralized oracles (NEVER single-source)
- [ ] Implement TWAP for price feeds
- [ ] Use median of 3+ oracles for critical operations
- [ ] Add oracle staleness checks (max 1 hour old)
- [ ] Validate oracle prices are reasonable
- [ ] Test oracle manipulation scenarios

**Swap Operations**:
- [ ] Implement maximum slippage protection (0.5% default)
- [ ] Add price impact warnings (5%+ warn, 15%+ require confirmation)
- [ ] Check token approvals before swaps
- [ ] Implement deadline enforcement (60 seconds)
- [ ] Test with high-volatility scenarios
- [ ] Add MEV protection for large swaps

**Flash Loan Protection**:
- [ ] Detect abnormal balance increases (1000%+ in one block)
- [ ] Add balance verification at block boundaries
- [ ] Implement rate limiting for high-value operations
- [ ] Test with simulated flash loan attacks

---

### Cross-Chain Bridge Operations

**Deposit Validation**:
- [ ] Wait for 128+ confirmations on source chain
- [ ] Verify deposit event in transaction logs
- [ ] Check bridge balance actually increased
- [ ] Prevent double-spending (track processed deposits in DB)
- [ ] Implement timelock for large transfers (24 hours)
- [ ] Use 7-of-10 multisig minimum
- [ ] Test fake deposit event detection

**Transfer Execution**:
- [ ] Verify signatures from multiple validators
- [ ] Implement rate limiting for bridge transfers
- [ ] Add maximum transfer amount per transaction
- [ ] Create emergency pause mechanism
- [ ] Test bridge failure scenarios

---

### Memory & Resource Management

**WebSocket Connections**:
- [ ] Implement proper WebSocket cleanup
- [ ] Add ping/pong for connection health
- [ ] Remove all event listeners on disconnect
- [ ] Set up process exit handlers (SIGINT, SIGTERM)
- [ ] Test for memory leaks (run for 24+ hours)
- [ ] Monitor active connection count

**Provider Pool**:
- [ ] Implement connection pool with max limit (10 connections)
- [ ] Add connection reuse logic
- [ ] Create connection lifecycle management
- [ ] Test pool exhaustion scenarios
- [ ] Add connection health checks

**Cache Management**:
- [ ] Implement TTL for all cached data (30 seconds for balances)
- [ ] Add event-driven cache invalidation
- [ ] Create cache cleanup routine
- [ ] Test cache consistency
- [ ] Monitor cache hit rate

---

### Testing Requirements

**Unit Tests** (Per Component):
- [ ] Test all happy paths
- [ ] Test all edge cases identified in checklist
- [ ] Test error conditions
- [ ] Test boundary values (zero, max uint256, etc.)
- [ ] Test concurrent operations
- [ ] Achieve 90%+ code coverage
- [ ] Security-critical code: 100% coverage

**Integration Tests**:
- [ ] Test with local blockchain nodes (Hardhat, Solana validator)
- [ ] Test MCP server integration
- [ ] Test agent coordination
- [ ] Test end-to-end workflows
- [ ] Achieve 70%+ coverage

**Security Tests**:
- [ ] Test with malicious inputs
- [ ] Test reentrancy attacks
- [ ] Test integer overflow attempts
- [ ] Test access control
- [ ] Test rate limiting
- [ ] Run Slither on all contracts

**Load Tests**:
- [ ] Test 100+ concurrent transactions
- [ ] Test RPC rate limiting
- [ ] Test memory usage over 24 hours
- [ ] Test WebSocket connection stability
- [ ] Test database connection pool

**Edge Case Tests**:
- [ ] Simulate chain reorgs
- [ ] Test blockhash expiration (Solana)
- [ ] Test gas price spikes
- [ ] Test nonce collisions
- [ ] Test MCP server disconnection
- [ ] Test bridge deposit validation

---

## Monitoring & Alerting Setup

**Critical Alerts** (PagerDuty/on-call):
- [ ] Private key access attempts
- [ ] Reentrancy attack detected
- [ ] Oracle manipulation detected
- [ ] Nonce desync > 5
- [ ] Gas price > 500 gwei
- [ ] MCP server down > 2 minutes
- [ ] Bridge transfer > $100K
- [ ] Unusual balance changes

**Warning Alerts** (Slack/email):
- [ ] Gas price > 200 gwei
- [ ] RPC rate limiting triggered
- [ ] Nonce desync > 2
- [ ] Cache miss rate > 50%
- [ ] Memory usage > 80%
- [ ] Transaction pending > 5 minutes

**Metrics to Track**:
- [ ] Transaction success rate
- [ ] Average gas price paid
- [ ] Nonce sync status
- [ ] RPC response time
- [ ] Cache hit rate
- [ ] Memory usage
- [ ] Active WebSocket connections
- [ ] MCP server uptime

---

## Pre-Production Checklist

Before deploying to production:

### Security Audit:
- [ ] Internal code review completed
- [ ] External security audit completed
- [ ] All P0 and P1 edge cases addressed
- [ ] Penetration testing completed
- [ ] Bug bounty program considered

### Infrastructure:
- [ ] Redundant RPC providers configured (3+)
- [ ] Redis cluster for nonce management
- [ ] Database backups configured
- [ ] Monitoring dashboards created
- [ ] Alert routing configured
- [ ] Incident response plan documented

### Testing:
- [ ] All tests passing
- [ ] Load testing completed
- [ ] 24-hour stability test passed
- [ ] Testnet deployment tested
- [ ] Rollback procedure tested

### Documentation:
- [ ] All edge cases documented
- [ ] Runbooks created for common issues
- [ ] On-call guide created
- [ ] Architecture diagram updated
- [ ] API documentation complete

### Compliance:
- [ ] No private keys in code/config
- [ ] Secrets in secure vault (not .env files)
- [ ] GDPR compliance reviewed (if applicable)
- [ ] Audit logging enabled
- [ ] Access control reviewed

---

## Post-Deployment Monitoring

**First 24 Hours**:
- [ ] Monitor all alerts closely
- [ ] Check transaction success rate
- [ ] Verify gas prices are reasonable
- [ ] Check nonce sync status
- [ ] Monitor memory usage
- [ ] Review error logs

**First Week**:
- [ ] Analyze transaction patterns
- [ ] Identify optimization opportunities
- [ ] Review incident response
- [ ] Update documentation based on issues
- [ ] Schedule retrospective

**Ongoing**:
- [ ] Weekly monitoring review
- [ ] Monthly edge case review
- [ ] Quarterly security audit
- [ ] Continuous optimization

---

## Incident Response Playbook

### Chain Reorg Detected:
1. Pause new transactions immediately
2. Identify affected transactions
3. Verify current chain state
4. Re-submit failed transactions
5. Increase confirmation requirements temporarily
6. Document incident

### Nonce Desync:
1. Stop transaction queue
2. Sync nonce with chain (`getTransactionCount('pending')`)
3. Update Redis and database
4. Review pending transactions
5. Resume queue with correct nonce
6. Monitor closely for 1 hour

### Gas Price Spike (>500 gwei):
1. Pause non-essential transactions
2. Alert users about high gas prices
3. Wait for gas to decrease
4. Monitor gas price trends
5. Resume when < 200 gwei

### MCP Server Down:
1. Check server logs
2. Attempt auto-reconnect
3. Failover to backup server if available
4. Alert on-call engineer if down > 2 minutes
5. Investigate root cause
6. Document incident

### Oracle Manipulation Suspected:
1. Halt affected operations immediately
2. Compare multiple oracle sources
3. Check for flash loan activity
4. Verify on-chain prices manually
5. Contact oracle provider
6. Resume only after verification

---

## Deployment Checklist

**Source**: Forensic analysis of zmartV0.69 and kektechV0.69 (456 commits analyzed)
**Impact Prevention**: 40% of development time (18+ hours saved per project)

### Pre-Deployment Validation

**Environment Variables**:
- [ ] All variables documented in `.env.example` with descriptions
- [ ] Environment validation script created (`scripts/validate-env.sh`)
- [ ] No trailing newlines in `.env` files (`cat .env | od -c`)
- [ ] No Windows line endings (CRLF) in `.env` files
- [ ] Zod schema validates all environment variables on startup
- [ ] Required vs optional variables clearly marked
- [ ] Sensitive variables flagged for Vercel encryption
- [ ] Test: Run `pnpm validate:env` successfully

**Build Verification**:
- [ ] TypeScript compilation succeeds with 0 errors
- [ ] All tests pass (`pnpm test`)
- [ ] Compiled artifacts exist (`test -f dist/index.js`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Database migrations prepared (`npx prisma migrate status`)
- [ ] No build-time dependencies on runtime variables (e.g., DATABASE_URL)
- [ ] Test: Local build completes successfully (`vercel build` or `pnpm build`)

**Code Quality**:
- [ ] No `any` types (use proper TypeScript types)
- [ ] Shared types between frontend/backend (`packages/shared/`)
- [ ] Zod schemas for all API endpoints
- [ ] Parameter names consistent (no `address` vs `walletAddress` mismatches)
- [ ] Contract tests validate API schemas
- [ ] Test: Contract tests pass

---

### Vercel Frontend Deployment (Monorepo)

**Configuration Files**:
- [ ] `vercel.json` exists in repository root
- [ ] `rootDirectory` set to frontend location (`frontend/` or `packages/frontend/`)
- [ ] `installCommand` runs from workspace root (`cd ../.. && pnpm install`)
- [ ] `buildCommand` configured correctly
- [ ] `outputDirectory` set to `.next`
- [ ] `.npmrc` exists with correct hoisting settings
- [ ] `package.json` has `"packageManager": "pnpm@8.x"` (or appropriate version)
- [ ] Test: `vercel build` succeeds locally

**Environment Variables (Vercel Dashboard)**:
- [ ] All `NEXT_PUBLIC_*` variables added
- [ ] Runtime variables added (DATABASE_URL, API keys, etc.)
- [ ] "Sensitive" flag enabled for secrets
- [ ] Variables set for all environments (Production, Preview, Development)
- [ ] Test: Check `vercel env ls` shows all variables

**Prisma/Database (if applicable)**:
- [ ] Lazy initialization implemented (`getPrisma()` function)
- [ ] No eager `new PrismaClient()` at module level
- [ ] `postinstall` script generates Prisma client
- [ ] No `DATABASE_URL` required during build
- [ ] Test: Vercel build succeeds without DATABASE_URL

**Post-Deployment Verification**:
- [ ] HTTPS works (no browser warnings)
- [ ] No console errors
- [ ] All pages load correctly
- [ ] API calls succeed (check Network tab)
- [ ] No "Mixed Content" errors
- [ ] Test: Visit production URL and verify functionality

---

### VPS Backend Deployment

**Server Setup**:
- [ ] SSH key authentication configured (no password login)
- [ ] UFW firewall configured (SSH, HTTP, HTTPS, backend port)
- [ ] fail2ban installed and running
- [ ] Node.js 20+ installed (via nvm)
- [ ] PM2 installed globally (`npm install -g pm2`)
- [ ] PM2 startup script configured (`pm2 startup`)
- [ ] Test: SSH into server successfully

**PM2 Configuration**:
- [ ] `ecosystem.config.js` created with all services
- [ ] `pre_deploy_local: 'npm run build && npm run test'` configured
- [ ] `max_restarts: 10` to prevent infinite loops
- [ ] `min_uptime: '10s'` to detect crash loops
- [ ] `wait_ready: true` for graceful startup
- [ ] `max_memory_restart: '500M'` for leak protection
- [ ] Log files configured (`error_file`, `out_file`)
- [ ] Test: Validate config with `pm2 start ecosystem.config.js --dry-run`

**Build & Deploy**:
- [ ] TypeScript built (`npm run build`)
- [ ] Compiled files verified (`test -f dist/index.js`)
- [ ] Environment variables validated (`./scripts/validate-env.sh`)
- [ ] Database migrations run (`npx prisma migrate deploy`)
- [ ] PM2 processes started (`pm2 start ecosystem.config.js`)
- [ ] PM2 process list saved (`pm2 save`)
- [ ] Test: `pm2 status` shows all services "online" with 0 restarts

**Crash Loop Detection**:
- [ ] Monitor PM2 for 30 seconds after start
- [ ] Check restart count is 0 or very low
- [ ] Check uptime is increasing (not stuck at <10s)
- [ ] Check logs are populating (`pm2 logs --lines 50`)
- [ ] If crash loop detected: Check environment variables, verify build, check logs
- [ ] Test: `pm2 status | grep -E 'online.*0.*[0-9]+m'` (should match)

**HTTPS/WSS Configuration**:
- [ ] Cloudflare Tunnel installed (`cloudflared`)
- [ ] Tunnel created (`cloudflared tunnel create backend-api`)
- [ ] DNS routed (`cloudflared tunnel route dns ...`)
- [ ] Tunnel config created (`~/.cloudflared/config.yml`)
- [ ] Tunnel running as service (`systemctl status cloudflared`)
- [ ] Test: `curl https://api.yourdomain.com/health` returns 200

**Health Checks**:
- [ ] Health check endpoint implemented (`/health`)
- [ ] Readiness endpoint implemented (`/ready`)
- [ ] Health checks validate database connection
- [ ] Health checks validate blockchain RPC connection
- [ ] Automated health check script runs every 5 minutes (cron)
- [ ] Test: `curl http://localhost:4000/health` returns { status: 'ok' }

---

### Post-Deployment Validation

**Frontend Verification**:
- [ ] HTTPS working (no warnings)
- [ ] All pages accessible
- [ ] Wallet connection works
- [ ] API calls succeed
- [ ] WebSocket connects (check Network → WS tab)
- [ ] No "Mixed Content" errors in console
- [ ] Dark mode works (if applicable)
- [ ] No JavaScript errors in console
- [ ] Test: Manual walkthrough of critical user flows

**Backend Verification**:
- [ ] All PM2 processes show "online"
- [ ] No crash loops (restart count < 5)
- [ ] Health checks return 200 OK
- [ ] Logs show no errors
- [ ] Database connection working
- [ ] Blockchain RPC connection working
- [ ] Environment variables loaded correctly
- [ ] Test: `pm2 logs --lines 100` shows clean logs

**Integration Verification**:
- [ ] Frontend can call backend API (HTTPS → HTTPS)
- [ ] WebSocket real-time updates working
- [ ] Database writes from backend appear in frontend
- [ ] Blockchain events trigger backend updates
- [ ] CORS allows frontend requests
- [ ] Test: Complete end-to-end user flow (e.g., create market, place bet)

**Performance Verification**:
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] WebSocket latency < 100ms
- [ ] No memory leaks (stable over 1 hour)
- [ ] CPU usage reasonable (< 50% average)
- [ ] Test: Monitor for 1 hour, check metrics

---

### Rollback Procedures

**Frontend (Vercel)**:
- [ ] Document current deployment URL
- [ ] Vercel Dashboard → Deployments → Previous deployment → "Promote to Production"
- [ ] Alternative: `git revert HEAD && git push`
- [ ] Test: Verify rollback restores functionality

**Backend (VPS)**:
- [ ] Script ready: `./scripts/rollback.sh`
- [ ] Manual: `git reset --hard HEAD~1 && npm install && npm run build && pm2 reload all`
- [ ] Database rollback: `npx prisma migrate resolve --rolled-back MIGRATION_NAME`
- [ ] Test: Practice rollback in staging environment

**Database**:
- [ ] Backup taken before migrations
- [ ] Rollback migration prepared (if breaking change)
- [ ] Restore procedure documented
- [ ] Test: Verify backup restore works

---

### Common Issues & Fixes

**Vercel Build Fails: "Cannot find package.json"**:
- Fix: Check `rootDirectory` in `vercel.json`
- Fix: Verify `installCommand` runs from workspace root

**Vercel Build Fails: "Prisma Client not generated"**:
- Fix: Add `"postinstall": "prisma generate"` to `package.json`

**Vercel Build Fails: "DATABASE_URL required"**:
- Fix: Use lazy Prisma initialization (see Guide 18, Section 4.1)

**PM2 Crash Loop (high restart count)**:
- Fix 1: Check environment variables (`./scripts/validate-env.sh`)
- Fix 2: Verify build completed (`test -f dist/index.js`)
- Fix 3: Check logs (`pm2 logs --err`)

**Mixed Content Error (HTTP blocked from HTTPS)**:
- Fix: Use Cloudflare Tunnel for backend HTTPS (see Guide 17, Section 2.4)

**API Calls Fail with DNS Error**:
- Fix: Check for newline in environment variables (`cat .env | od -c`)

**Parameter Mismatch (silent failures)**:
- Fix: Use shared TypeScript types (see Guide 18, Section 1.1)

---

## Edge Case Coverage Matrix

Track edge case implementation across components:

| Edge Case | MCP Eth | MCP Sol | MCP Multi | Orchestrator | Wallet | TX Builder | Gas Opt | Contract Analyzer | Frontend | Backend |
|-----------|---------|---------|-----------|--------------|--------|------------|---------|------------------|----------|---------|
| Chain Reorg | ✅ | N/A | ✅ | ✅ | - | ✅ | - | - | - | - |
| MEV Protection | ✅ | ⚠️ | ✅ | - | - | ✅ | - | - | - | - |
| Gas Spikes | ✅ | N/A | ✅ | - | - | ✅ | ✅ | - | - | - |
| Nonce Collision | ✅ | N/A | ✅ | - | - | ✅ | - | - | - | - |
| RPC Rate Limit | ✅ | ✅ | ✅ | - | - | - | - | - | - | - |
| Input Validation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reentrancy | - | - | - | - | ✅ | - | - | ✅ | - | - |
| Oracle Manip | ⚠️ | - | ⚠️ | ✅ | - | - | - | - | - | - |
| Private Key | - | - | - | - | ✅ | - | - | - | - | - |
| Blockhash Exp | N/A | ✅ | ✅ | - | - | - | - | - | - | - |
| WS Leaks | ✅ | ✅ | ✅ | - | - | - | - | - | ✅ | ✅ |
| Cache Stale | ✅ | ✅ | ✅ | ✅ | - | - | - | - | ✅ | ✅ |
| **Deployment Edge Cases** | | | | | | | | | | |
| PM2 Crash Loop | - | - | - | - | - | - | - | - | - | ✅ |
| Env Var Newlines | - | - | - | - | - | - | - | - | ✅ | ✅ |
| HTTPS/WSS Mixed | - | - | - | - | - | - | - | - | ✅ | ✅ |
| Vercel Monorepo | - | - | - | - | - | - | - | - | ✅ | - |
| Prisma Build-Time | - | - | - | - | - | - | - | - | ✅ | - |
| DB Schema Drift | - | - | - | - | - | - | - | - | - | ✅ |
| Parameter Mismatch | - | - | - | - | - | - | - | - | ✅ | ✅ |

**Legend**:
- ✅ = Must implement
- ⚠️ = Conditional (depends on features)
- - = Not applicable

---

## Quick Reference: Priority Edge Cases

### P0 (Must Fix Before Production):
1. **Private Key Compromise** → Multi-sig + hardware wallets + encryption
2. **Reentrancy Attacks** → NonReentrant guards + checks-effects-interactions
3. **Oracle Manipulation** → Chainlink + TWAP + median of 3+

### P1 (Must Fix During Development):
4. **PM2 Crash Loops** → Pre-deployment checks + environment validation
5. **Vercel Monorepo Build** → Correct vercel.json + rootDirectory
6. **Nonce Collisions** → Redis-based nonce manager + locking
7. **Blockhash Expiration** → Fresh blockhash + retry logic
8. **RPC Rate Limiting** → Bottleneck + multi-provider failover
9. **Chain Reorgs** → Deep confirmations + reorg detection

### P2 (Should Fix Before Scale):
10. **HTTPS/WSS Mixed Content** → Cloudflare Tunnel + HTTPS enforcement
11. **Parameter Mismatches** → Shared TypeScript types + Zod validation
12. **MEV Sandwich** → Flashbots + slippage protection
13. **Gas Price Spikes** → Dynamic gas + ceiling enforcement
14. **Env Var Newlines** → Validation scripts + pre-build checks
15. **Database Schema Drift** → Prisma schema + migrations
16. **WebSocket Leaks** → Proper cleanup + lifecycle management

### P3 (Nice to Have):
17. **Prisma Build-Time** → Lazy initialization + postinstall script
18. **Cache Staleness** → Event-driven invalidation + TTL

---

## Success Metrics

Track these metrics to ensure edge case handling is effective:

- **Transaction Success Rate**: > 99% (excluding user errors)
- **Nonce Collision Rate**: < 0.1%
- **Average Gas Price**: Within 20% of network average
- **RPC Failover Rate**: < 5% of requests
- **Memory Leak Rate**: 0 (stable over 7 days)
- **Cache Hit Rate**: > 80%
- **MCP Server Uptime**: > 99.9%
- **Mean Time to Detect (MTTD) Critical Issues**: < 1 minute
- **Mean Time to Resolve (MTTR) Critical Issues**: < 15 minutes

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Status**: Production-Ready
**Review Frequency**: After each component implementation
