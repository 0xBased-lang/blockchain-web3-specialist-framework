# Data Corruption Scenarios & Prevention

## Overview

This document identifies all potential data corruption scenarios in the Blockchain Web3 Specialist Framework, their impact, likelihood, and prevention strategies.

## Corruption Taxonomy

### Severity Levels

- **🔴 Critical**: Loss of funds, security breach
- **🟠 High**: System unavailable, data loss
- **🟡 Medium**: Degraded performance, temporary issues
- **🟢 Low**: Minor inconvenience, easily recoverable

### Likelihood Levels

- **Frequent**: Will happen regularly
- **Occasional**: May happen occasionally
- **Rare**: Unlikely but possible
- **Very Rare**: Extremely unlikely

---

## 1. Blockchain State Corruption

### 1.1 Stale Cache Data

**Severity**: 🟠 High (incorrect balance/state displayed)
**Likelihood**: Frequent

**Scenario**:
```typescript
// User checks balance: 10 ETH (cached)
// Meanwhile, transaction sent: -5 ETH
// User tries to send 8 ETH → FAILS (insufficient funds)
// Cache showed 10 ETH, actual balance is 5 ETH
```

**Root Causes**:
- Cache not invalidated after transactions
- No cache expiration policy
- No event monitoring for account changes

**Prevention**:

```typescript
// 1. Short TTL for mutable data
const CACHE_CONFIG = {
  balance: { ttl: 12_000 }, // 12 seconds (1 block)
  nonce: { ttl: 0 }, // Never cache
  transaction: { ttl: Infinity }, // Immutable
};

// 2. Invalidate on write
async function sendTransaction(tx: Transaction) {
  const result = await blockchain.sendTx(tx);
  await cache.invalidate(`balance:${tx.from}`);
  await cache.invalidate(`nonce:${tx.from}`);
  return result;
}

// 3. Event-based invalidation
blockchain.on('block', () => {
  cache.invalidateMatching(/^balance:/);
});
```

**Detection**:
```typescript
// Periodic consistency checks
async function validateCacheConsistency() {
  const cachedBalance = await cache.get('balance:0x123');
  const actualBalance = await blockchain.getBalance('0x123');

  if (cachedBalance !== actualBalance) {
    await alerting.warn('Cache inconsistency detected');
    await cache.invalidate('balance:0x123');
  }
}
```

### 1.2 Nonce Corruption

**Severity**: 🔴 Critical (transactions fail or get stuck)
**Likelihood**: Occasional

**Scenario**:
```typescript
// Transaction 1: nonce 10 (sent)
// Transaction 2: nonce 10 (duplicate! corrupted)
// → Transaction 2 replaces Transaction 1
// → Unintended behavior, possible loss
```

**Root Causes**:
- Concurrent transactions from same account
- Nonce not incremented atomically
- No nonce tracking across restarts

**Prevention**:

```typescript
// Centralized nonce manager with locking
class NonceManager {
  private locks = new Map<string, Promise<void>>();
  private nonces = new Map<string, number>();

  async getNextNonce(address: string): Promise<number> {
    // Acquire lock for this address
    await this.acquireLock(address);

    try {
      // Get current nonce from blockchain
      const chainNonce = await blockchain.getTransactionCount(address, 'pending');

      // Get our tracked nonce
      const trackedNonce = this.nonces.get(address) ?? chainNonce;

      // Use the higher one (safety)
      const nonce = Math.max(chainNonce, trackedNonce);

      // Increment and persist
      this.nonces.set(address, nonce + 1);
      await this.persistNonce(address, nonce + 1);

      return nonce;
    } finally {
      this.releaseLock(address);
    }
  }

  private async persistNonce(address: string, nonce: number) {
    // Persist to disk for restart recovery
    await db.set(`nonce:${address}`, nonce);
  }
}
```

**Recovery**:
```typescript
// Detect stuck transactions
async function detectStuckTransactions() {
  const pending = await db.getPendingTransactions();

  for (const tx of pending) {
    const age = Date.now() - tx.timestamp;

    if (age > 5 * 60 * 1000) { // 5 minutes
      // Transaction stuck, reset nonce
      await nonceManager.reset(tx.from);
      await alerting.error(`Stuck transaction detected: ${tx.hash}`);
    }
  }
}
```

### 1.3 Chain Reorganization (Reorg)

**Severity**: 🟠 High (confirmed transactions become unconfirmed)
**Likelihood**: Rare (but happens on all blockchains)

**Scenario**:
```
Block 100: Transaction A confirmed ✓
Block 101: Transaction B confirmed ✓
  ↓
[REORG HAPPENS]
  ↓
Block 100': Different block
Block 101': Transaction A not included!
Transaction A is now UNCONFIRMED
```

**Prevention**:

```typescript
// Wait for sufficient confirmations
const REQUIRED_CONFIRMATIONS = {
  ethereum: 12, // ~3 minutes
  polygon: 128, // ~5 minutes
  solana: 32, // ~15 seconds
};

async function waitForConfirmations(txHash: string, chain: string) {
  const required = REQUIRED_CONFIRMATIONS[chain];
  let confirmations = 0;

  while (confirmations < required) {
    const receipt = await blockchain.getTransactionReceipt(txHash);
    const currentBlock = await blockchain.getBlockNumber();

    confirmations = currentBlock - receipt.blockNumber;

    if (confirmations < required) {
      await sleep(12000); // Wait 1 block
    }
  }

  // Double-check transaction still exists
  const finalReceipt = await blockchain.getTransactionReceipt(txHash);
  if (!finalReceipt) {
    throw new ReorgError('Transaction disappeared after reorg');
  }
}
```

**Detection**:
```typescript
// Monitor for reorgs
blockchain.on('block', async (blockNumber) => {
  const block = await blockchain.getBlock(blockNumber);
  const previousBlock = await blockchain.getBlock(blockNumber - 1);

  if (block.parentHash !== previousBlock.hash) {
    await alerting.critical('Chain reorganization detected!');
    await handleReorg(blockNumber);
  }
});
```

---

## 2. Agent State Corruption

### 2.1 Conflicting Agent Actions

**Severity**: 🟠 High (duplicate operations, wasted gas)
**Likelihood**: Occasional

**Scenario**:
```typescript
// User: "Swap 1 ETH for USDC"
// Orchestrator delegates to DeFi Agent
// Network error → timeout
// Orchestrator retries → delegates again
// → TWO swaps executed (2 ETH swapped instead of 1)
```

**Prevention**:

```typescript
// Idempotency keys for all operations
class OperationTracker {
  private operations = new Map<string, OperationStatus>();

  async executeOnce(key: string, operation: () => Promise<any>) {
    // Check if already executed
    const existing = this.operations.get(key);
    if (existing?.status === 'completed') {
      return existing.result;
    }
    if (existing?.status === 'in_progress') {
      // Wait for completion
      return await this.waitForCompletion(key);
    }

    // Mark as in progress
    this.operations.set(key, { status: 'in_progress', startedAt: Date.now() });

    try {
      const result = await operation();
      this.operations.set(key, { status: 'completed', result });
      return result;
    } catch (error) {
      this.operations.set(key, { status: 'failed', error });
      throw error;
    }
  }
}

// Usage
const key = `swap:${userId}:${timestamp}:${nonce}`;
await operationTracker.executeOnce(key, () => defiAgent.swap(params));
```

### 2.2 Agent State Desynchronization

**Severity**: 🟡 Medium (incorrect decisions)
**Likelihood**: Occasional

**Scenario**:
```
Agent A: Thinks wallet has 10 ETH
Agent B: Thinks wallet has 5 ETH
Agent A tries to send 8 ETH → FAILS
```

**Prevention**:

```typescript
// Single source of truth: Blockchain
// Agents NEVER maintain state, always query

class BlockchainAgent {
  // ❌ BAD
  private cachedBalance: bigint;

  async sendTransaction(amount: bigint) {
    if (amount > this.cachedBalance) {
      throw new Error('Insufficient funds');
    }
  }

  // ✅ GOOD
  async sendTransaction(address: string, amount: bigint) {
    const currentBalance = await this.mcpClient.call('ethereum:get_balance', { address });

    if (amount > currentBalance) {
      throw new Error('Insufficient funds');
    }
  }
}
```

---

## 3. MCP Server Corruption

### 3.1 Resource Definition Mismatch

**Severity**: 🟡 Medium (queries fail)
**Likelihood**: Rare

**Scenario**:
```typescript
// MCP Server defines resource
resources: {
  "accounts": "ethereum://accounts/{address}"
}

// Client requests
await client.readResource("ethereum://wallets/0x123");
// ❌ Mismatch! Resource not found
```

**Prevention**:

```typescript
// Schema-driven resource definitions
const RESOURCE_SCHEMA = z.object({
  accounts: z.literal('ethereum://accounts/{address}'),
  contracts: z.literal('ethereum://contracts/{address}'),
});

// Validate at startup
function validateResources(server: MCPServer) {
  const defined = server.getResources();
  const expected = RESOURCE_SCHEMA.parse(defined);

  if (!deepEqual(defined, expected)) {
    throw new Error('Resource schema mismatch');
  }
}
```

### 3.2 Tool Parameter Corruption

**Severity**: 🔴 Critical (wrong transaction sent)
**Likelihood**: Rare

**Scenario**:
```typescript
// Client sends
await client.callTool('send_transaction', {
  to: '0x123',
  value: '1000000000000000000' // 1 ETH as string
});

// Server expects bigint, receives string
// Implicit conversion → corruption or error
```

**Prevention**:

```typescript
// Strict type validation with Zod
const SendTransactionSchema = z.object({
  to: AddressSchema,
  value: BigIntSchema, // Custom schema with coercion
  data: HexSchema.optional(),
});

function sendTransactionTool(args: unknown) {
  // Parse and validate
  const params = SendTransactionSchema.parse(args);

  // Now params.value is definitely a bigint
  return blockchain.sendTransaction(params);
}

// Custom BigInt schema with safe coercion
const BigIntSchema = z.union([
  z.bigint(),
  z.string().transform((val) => {
    try {
      return BigInt(val);
    } catch {
      throw new Error('Invalid bigint string');
    }
  }),
  z.number().transform((val) => {
    if (!Number.isInteger(val)) {
      throw new Error('Bigint must be integer');
    }
    return BigInt(val);
  }),
]);
```

---

## 4. Wallet & Key Management Corruption

### 4.1 Private Key Exposure

**Severity**: 🔴 Critical (total loss of funds)
**Likelihood**: Rare (with proper security)

**Scenarios**:
- Key logged to console/file
- Key sent over unencrypted connection
- Key stored in plaintext
- Key leaked in error messages

**Prevention**:

```typescript
// 1. Never store keys in plaintext
class WalletManager {
  private keys: Map<string, EncryptedKey> = new Map();

  async addKey(privateKey: string, password: string) {
    // Encrypt immediately
    const encrypted = await this.encrypt(privateKey, password);

    // Wipe original from memory
    privateKey = '0'.repeat(64);

    // Store encrypted only
    this.keys.set(address, encrypted);
  }

  async sign(address: string, data: string, password: string) {
    const encrypted = this.keys.get(address);

    // Decrypt only in memory, only when needed
    const key = await this.decrypt(encrypted, password);

    try {
      const signature = await this.doSign(key, data);
      return signature;
    } finally {
      // Wipe key from memory immediately
      key = '0'.repeat(64);
    }
  }
}

// 2. Never log keys
const REDACT_PATTERNS = [
  /0x[a-fA-F0-9]{64}/, // Private keys
  /[a-zA-Z0-9]{88}/, // Base58 private keys (Solana)
];

function sanitizeLog(message: string): string {
  let sanitized = message;
  for (const pattern of REDACT_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

// 3. Never expose in errors
class SafeError extends Error {
  constructor(message: string, private sensitive: unknown) {
    super(sanitizeLog(message));
  }

  toJSON() {
    return { message: this.message }; // Never include sensitive
  }
}
```

### 4.2 Mnemonic/Seed Phrase Corruption

**Severity**: 🔴 Critical (permanent loss of access)
**Likelihood**: Very Rare

**Scenarios**:
- Incorrect word encoding
- Wrong derivation path
- Corrupted entropy

**Prevention**:

```typescript
// BIP39 validation
import { validateMnemonic, mnemonicToSeed } from 'bip39';

function validateAndStoreMnemonic(mnemonic: string) {
  // Validate checksum
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic checksum');
  }

  // Test derivation before storing
  const seed = mnemonicToSeed(mnemonic);
  const testWallet = HDNode.fromSeed(seed);
  const testAddress = testWallet.derivePath("m/44'/60'/0'/0/0").address;

  // Verify we can derive addresses
  if (!testAddress) {
    throw new Error('Mnemonic derivation failed');
  }

  // Store encrypted
  return encryptMnemonic(mnemonic);
}
```

---

## 5. Transaction Corruption

### 5.1 Gas Price Manipulation

**Severity**: 🟠 High (overpayment or stuck transactions)
**Likelihood**: Occasional

**Scenario**:
```typescript
// Attacker modifies gas price feed
// Reported gas price: 1000 gwei (actual: 50 gwei)
// User overpays 20x
```

**Prevention**:

```typescript
// Multiple gas price sources
async function getGasPrice(): Promise<bigint> {
  const sources = [
    () => etherscan.getGasPrice(),
    () => alchemy.getGasPrice(),
    () => infura.getGasPrice(),
  ];

  const prices = await Promise.all(sources.map(s => s()));

  // Remove outliers (outside 2 standard deviations)
  const filtered = removeOutliers(prices);

  // Use median of remaining
  const median = getMedian(filtered);

  // Sanity check: not more than 500 gwei
  if (median > parseUnits('500', 'gwei')) {
    throw new Error('Gas price unreasonably high');
  }

  return median;
}
```

### 5.2 Transaction Replay Attacks

**Severity**: 🔴 Critical (duplicate transactions, loss of funds)
**Likelihood**: Rare (prevented by EIP-155)

**Scenario**:
```
Transaction on Ethereum mainnet
→ Replayed on Ethereum Classic
→ Double-spend
```

**Prevention**:

```typescript
// Always include chainId (EIP-155)
const transaction = {
  to: '0x123',
  value: parseEther('1'),
  chainId: 1, // Ethereum mainnet
};

// Verify chainId matches
if (transaction.chainId !== await provider.getNetwork().chainId) {
  throw new Error('ChainId mismatch - replay attack?');
}
```

---

## 6. Cross-Chain Corruption

### 6.1 Bridge State Inconsistency

**Severity**: 🔴 Critical (tokens lost in bridge)
**Likelihood**: Rare

**Scenario**:
```
Tokens locked on Chain A ✓
Bridge fails to mint on Chain B ✗
→ Tokens stuck forever
```

**Prevention**:

```typescript
// Atomic cross-chain operations with monitoring
async function bridgeTokens(from: Chain, to: Chain, amount: bigint) {
  // 1. Lock on source chain
  const lockTx = await from.lockTokens(amount);
  await lockTx.wait(12); // Wait for confirmations

  // 2. Create attestation
  const proof = await bridge.createProof(lockTx);

  // 3. Mint on destination with timeout
  try {
    const mintTx = await to.mintTokens(proof, { timeout: 300_000 });
    await mintTx.wait(12);
  } catch (error) {
    // Minting failed - initiate refund
    await from.unlockTokens(lockTx);
    throw new BridgeError('Bridge failed, tokens refunded');
  }

  // 4. Verify balances
  const sourceBalance = await from.getBalance();
  const destBalance = await to.getBalance();

  // Invariant: total should be conserved
  if (sourceBalance + destBalance !== initialTotal) {
    await alerting.critical('Bridge invariant violated!');
  }
}
```

---

## 7. Concurrency Corruption

### 7.1 Race Conditions

**Severity**: 🟠 High (duplicate operations, inconsistent state)
**Likelihood**: Frequent (in high-traffic scenarios)

**Scenario**:
```typescript
// Two parallel requests
Request 1: Send 10 ETH
Request 2: Send 10 ETH

Both check balance: 15 ETH ✓
Both try to send: FAIL (second one fails)
```

**Prevention**:

```typescript
// Distributed locks
import { Redlock } from 'redlock';

const redlock = new Redlock([redisClient]);

async function sendTransactionSafe(from: string, to: string, amount: bigint) {
  const lock = await redlock.acquire([`lock:${from}`], 5000);

  try {
    // Check balance while holding lock
    const balance = await getBalance(from);

    if (balance < amount) {
      throw new Error('Insufficient funds');
    }

    // Send transaction
    const tx = await sendTransaction({ from, to, amount });

    return tx;
  } finally {
    await lock.release();
  }
}
```

---

## 8. Data Persistence Corruption

### 8.1 Database Corruption

**Severity**: 🟠 High (loss of transaction history)
**Likelihood**: Rare

**Prevention**:

```typescript
// Write-ahead logging
async function saveTransaction(tx: Transaction) {
  // 1. Write to WAL first
  await wal.append(tx);

  try {
    // 2. Write to database
    await db.save(tx);

    // 3. Commit WAL
    await wal.commit(tx.id);
  } catch (error) {
    // Rollback from WAL
    await wal.rollback(tx.id);
    throw error;
  }
}

// Recovery on startup
async function recoverFromWAL() {
  const uncommitted = await wal.getUncommitted();

  for (const tx of uncommitted) {
    try {
      await db.save(tx);
      await wal.commit(tx.id);
    } catch (error) {
      logger.error(`Failed to recover transaction ${tx.id}`);
    }
  }
}
```

---

## Corruption Detection & Recovery

### Automated Health Checks

```typescript
// Run every 5 minutes
async function healthCheck() {
  const checks = [
    checkCacheConsistency,
    checkNonceIntegrity,
    checkPendingTransactions,
    checkAgentStates,
    checkMCPServerHealth,
    checkWalletBalances,
  ];

  const results = await Promise.all(checks.map(check => check()));

  const failures = results.filter(r => !r.healthy);

  if (failures.length > 0) {
    await alerting.warn('Health check failures', failures);
    await attemptAutoRecovery(failures);
  }
}
```

### Manual Recovery Procedures

See `docs/operations/disaster-recovery.md` _(recommended file to create)_ for detailed recovery procedures.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Review Frequency**: Monthly
**Next Review**: 2025-12-14
