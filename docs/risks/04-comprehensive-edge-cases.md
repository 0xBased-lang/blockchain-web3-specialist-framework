# Comprehensive Edge Case Analysis & Mitigation Strategies

**Document Version**: 1.0.0
**Last Updated**: 2025-11-14
**Status**: Production-Ready
**Research Date**: 2024-2025 incidents and best practices

---

## Table of Contents

1. [Blockchain Transaction Edge Cases](#1-blockchain-transaction-edge-cases)
2. [DeFi Security Edge Cases](#2-defi-security-edge-cases)
3. [Infrastructure Edge Cases](#3-infrastructure-edge-cases)
4. [Cross-Chain Bridge Edge Cases](#4-cross-chain-bridge-edge-cases)
5. [Solana-Specific Edge Cases](#5-solana-specific-edge-cases)
6. [MCP Server Edge Cases](#6-mcp-server-edge-cases)
7. [Memory & Resource Management](#7-memory--resource-management)
8. [Cache Invalidation Edge Cases](#8-cache-invalidation-edge-cases)

---

## 1. Blockchain Transaction Edge Cases

### 1.1 Chain Reorganizations (Reorgs)

**Description**: Blockchain reorgs occur when the network switches to a different fork, potentially invalidating previously confirmed transactions.

**Real-World Impact**:
- Reorgs can be used for double-spending
- MEV extraction through time bandit attacks
- Transaction censorship

**Detection Strategy**:
```typescript
// Monitor chain reorgs
interface ReorgDetector {
  async detectReorg(txHash: string): Promise<ReorgInfo> {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { isReorged: false };

    const currentBlock = await provider.getBlock(receipt.blockNumber);
    if (!currentBlock) {
      return {
        isReorged: true,
        originalBlock: receipt.blockNumber,
        reason: 'Block no longer exists'
      };
    }

    // Check if transaction still exists in the block
    const txInBlock = currentBlock.transactions.includes(txHash);
    return {
      isReorged: !txInBlock,
      originalBlock: receipt.blockNumber,
      currentBlockHash: currentBlock.hash
    };
  }
}
```

**Prevention**:
```typescript
// Wait for deep confirmations
const SAFE_CONFIRMATIONS = {
  ethereum: 12,  // ~2.5 minutes
  polygon: 128,  // ~4 minutes
  bsc: 15,       // ~45 seconds
  arbitrum: 20   // ~20 seconds
};

async function waitForSafeConfirmation(
  txHash: string,
  chain: string
): Promise<void> {
  const requiredConfirmations = SAFE_CONFIRMATIONS[chain] || 12;
  const receipt = await provider.waitForTransaction(txHash, requiredConfirmations);

  if (!receipt || receipt.status !== 1) {
    throw new Error('Transaction failed or was reorged');
  }
}
```

**Testing**:
```typescript
describe('Reorg Handling', () => {
  it('should detect and handle reorged transactions', async () => {
    const detector = new ReorgDetector(provider);

    // Simulate reorg by forking chain
    await network.provider.send('evm_revert', [snapshotId]);

    const result = await detector.detectReorg(txHash);
    expect(result.isReorged).toBe(true);
  });
});
```

---

### 1.2 MEV (Maximal Extractable Value) Attacks

**Description**: Miners/validators reorder, insert, or censor transactions to extract value.

**Attack Types**:
- **Sandwich Attacks**: Front-run and back-run user transactions (51.56% of MEV, $289.76M in 2024)
- **Front-Running**: Insert transaction before victim's
- **Back-Running**: Insert transaction after victim's
- **Time Bandit Attacks**: Reorganize past blocks to extract MEV

**Real-World Data**: 124,946 sandwich attacks in October 2024 alone.

**Prevention**:
```typescript
// Use MEV protection services
class MEVProtectedTransaction {
  async sendWithProtection(tx: TransactionRequest): Promise<string> {
    // Option 1: Private mempool (Flashbots Protect)
    const flashbotsProvider = await providers.FlashbotsBundleProvider.create(
      provider,
      flashbotsSigner,
      'https://relay.flashbots.net'
    );

    const bundle = [{
      signer: signer,
      transaction: tx
    }];

    const signedBundle = await flashbotsProvider.signBundle(bundle);
    const simulation = await flashbotsProvider.simulate(signedBundle, targetBlock);

    if (simulation.firstRevert) {
      throw new Error('Bundle simulation failed');
    }

    // Send bundle
    const bundleReceipt = await flashbotsProvider.sendRawBundle(
      signedBundle,
      targetBlock
    );

    return bundleReceipt.bundleHash;
  }

  // Option 2: Maximum slippage protection
  async swapWithMaxSlippage(
    amountIn: bigint,
    path: string[],
    maxSlippage: number = 0.5 // 0.5% default
  ): Promise<string> {
    const amounts = await router.getAmountsOut(amountIn, path);
    const amountOutMin = amounts[amounts.length - 1] *
      BigInt((100 - maxSlippage) * 100) / 10000n;

    // Extremely tight deadline
    const deadline = Math.floor(Date.now() / 1000) + 60; // 60 seconds

    return await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      recipient,
      deadline
    );
  }
}
```

**Detection**:
```typescript
// Detect sandwich attacks post-mortem
async function detectSandwich(txHash: string): Promise<boolean> {
  const receipt = await provider.getTransactionReceipt(txHash);
  const block = await provider.getBlock(receipt.blockNumber);

  const txIndex = block.transactions.indexOf(txHash);
  const prevTx = block.transactions[txIndex - 1];
  const nextTx = block.transactions[txIndex + 1];

  if (!prevTx || !nextTx) return false;

  // Check if prev and next tx are from same address (sandwicher)
  const prevReceipt = await provider.getTransactionReceipt(prevTx);
  const nextReceipt = await provider.getTransactionReceipt(nextTx);

  return prevReceipt.from === nextReceipt.from;
}
```

---

### 1.3 Gas Price Spikes & Stuck Transactions

**Description**: Sudden gas price increases can cause transactions to remain pending indefinitely.

**Prevention**:
```typescript
// Dynamic gas price management with ceiling
class GasManager {
  private maxGasPrice = parseUnits('500', 'gwei'); // Never exceed 500 gwei

  async getOptimalGasPrice(): Promise<bigint> {
    const feeData = await provider.getFeeData();

    // EIP-1559 chains
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      const baseFee = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;

      // Add 20% buffer to base fee
      const bufferedBaseFee = baseFee * 120n / 100n;

      // Add priority fee
      const totalGas = bufferedBaseFee + feeData.maxPriorityFeePerGas;

      // Cap at maximum
      return totalGas > this.maxGasPrice ? this.maxGasPrice : totalGas;
    }

    // Legacy chains
    const gasPrice = feeData.gasPrice || 0n;
    const buffered = gasPrice * 120n / 100n;
    return buffered > this.maxGasPrice ? this.maxGasPrice : buffered;
  }

  // Replace stuck transaction
  async replaceStuckTx(
    originalTx: TransactionResponse
  ): Promise<TransactionResponse> {
    const nonce = originalTx.nonce;

    // Get current gas price
    const currentGas = await this.getOptimalGasPrice();

    // Must be at least 10% higher
    const replacementGas = originalTx.gasPrice * 110n / 100n;
    const finalGas = replacementGas > currentGas ? replacementGas : currentGas;

    if (finalGas > this.maxGasPrice) {
      throw new Error('Gas price too high to replace transaction');
    }

    // Send replacement with same nonce
    return await signer.sendTransaction({
      ...originalTx,
      nonce,
      gasPrice: finalGas
    });
  }
}
```

**Warning System**:
```typescript
// Alert when gas prices are dangerous
async function checkGasSafety(): Promise<GasAlert> {
  const gasPrice = await provider.getGasPrice();
  const gwei = formatUnits(gasPrice, 'gwei');

  if (parseFloat(gwei) > 500) {
    return {
      level: 'CRITICAL',
      message: `Gas price ${gwei} gwei exceeds maximum threshold`,
      recommendation: 'ABORT transaction or wait for gas to decrease'
    };
  }

  if (parseFloat(gwei) > 200) {
    return {
      level: 'WARNING',
      message: `Gas price ${gwei} gwei is very high`,
      recommendation: 'Consider waiting for lower gas prices'
    };
  }

  return { level: 'SAFE', message: `Gas price ${gwei} gwei is acceptable` };
}
```

---

## 2. DeFi Security Edge Cases

### 2.1 Private Key Compromises

**Severity**: CRITICAL
**2024 Impact**: $449M lost across 31 incidents (55.6% of all incidents)

**Prevention**:
```typescript
// Multi-signature wallet requirement
class SecureWalletManager {
  async createMultiSig(
    owners: string[],
    threshold: number
  ): Promise<string> {
    if (owners.length < 3) {
      throw new Error('Minimum 3 owners required');
    }

    if (threshold < Math.ceil(owners.length / 2)) {
      throw new Error('Threshold must be majority');
    }

    // Deploy Gnosis Safe or similar
    const factory = new GnosisSafeProxyFactory(signer);
    const safe = await factory.createProxy(owners, threshold);

    return safe.address;
  }

  // Hardware wallet enforcement
  async signWithHardware(
    message: string,
    walletType: 'ledger' | 'trezor'
  ): Promise<string> {
    if (walletType === 'ledger') {
      const transport = await TransportNodeHid.create();
      const eth = new Eth(transport);
      const signature = await eth.signPersonalMessage(path, message);
      return signature;
    }

    // Similar for Trezor
    throw new Error('Hardware wallet required for high-value operations');
  }
}
```

**Cold Storage Pattern**:
```typescript
// Hot wallet with limited funds, cold wallet for majority
class TwoTierWalletSystem {
  private hotWalletLimit = parseEther('10'); // Max 10 ETH in hot wallet

  async executeTransaction(amount: bigint): Promise<string> {
    const hotBalance = await provider.getBalance(hotWallet.address);

    if (amount > this.hotWalletLimit) {
      return await this.requestColdWalletApproval(amount);
    }

    if (hotBalance < amount) {
      await this.refillHotWallet();
    }

    return await hotWallet.sendTransaction({ to, value: amount });
  }

  private async requestColdWalletApproval(amount: bigint): Promise<string> {
    // Requires manual approval from cold wallet
    throw new Error(
      `Amount ${formatEther(amount)} ETH requires cold wallet approval. ` +
      `Please sign transaction manually.`
    );
  }
}
```

---

### 2.2 Input Validation Vulnerabilities

**Severity**: HIGH
**Impact**: 34.6% of direct contract exploits

**Prevention**:
```typescript
// Comprehensive input validation
import { z } from 'zod';

// Address validation with checksum
const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .refine((addr) => {
    // Verify checksum
    return ethers.getAddress(addr) === addr;
  }, 'Invalid address checksum');

// Amount validation with overflow protection
const AmountSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((val) => {
    const amount = BigInt(val);

    // Prevent negative amounts
    if (amount < 0n) {
      throw new Error('Amount cannot be negative');
    }

    // Prevent overflow (uint256 max)
    const MAX_UINT256 = BigInt(2) ** BigInt(256) - 1n;
    if (amount > MAX_UINT256) {
      throw new Error('Amount exceeds uint256 maximum');
    }

    return amount;
  });

// Transaction parameters with full validation
const TransactionParamsSchema = z.object({
  to: AddressSchema,
  value: AmountSchema,
  data: z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex data').optional(),
  gasLimit: AmountSchema.optional(),
  nonce: z.number().int().min(0).optional(),
});

// Usage
async function sendTransaction(params: unknown): Promise<string> {
  // Validate ALL inputs
  const validated = TransactionParamsSchema.parse(params);

  // Additional business logic validation
  const balance = await provider.getBalance(signer.address);
  if (validated.value > balance) {
    throw new Error('Insufficient balance');
  }

  return await signer.sendTransaction(validated);
}
```

**SQL Injection / XSS Prevention**:
```typescript
// Never concatenate user input into queries or HTML
class SecureStorage {
  // WRONG - vulnerable to injection
  async getUserWrong(address: string) {
    return await db.query(`SELECT * FROM users WHERE address = '${address}'`);
  }

  // CORRECT - parameterized query
  async getUserCorrect(address: string) {
    return await db.query('SELECT * FROM users WHERE address = $1', [address]);
  }

  // Sanitize all user input
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>\"'&]/g, (char) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
          '&': '&amp;'
        };
        return entities[char];
      });
  }
}
```

---

### 2.3 Reentrancy Attacks

**Severity**: CRITICAL
**2024 Impact**: $47M lost across 22 incidents

**Prevention**:
```typescript
// OpenZeppelin ReentrancyGuard pattern
abstract class ReentrancyGuard {
  private locked = false;

  protected async nonReentrant<T>(fn: () => Promise<T>): Promise<T> {
    if (this.locked) {
      throw new Error('Reentrant call detected');
    }

    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = false;
    }
  }
}

// Usage in contract interaction
class SecureVault extends ReentrancyGuard {
  async withdraw(amount: bigint): Promise<void> {
    return this.nonReentrant(async () => {
      // Check
      const balance = this.balances.get(msg.sender);
      if (!balance || balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Effects (update state BEFORE external call)
      this.balances.set(msg.sender, balance - amount);

      // Interactions (external calls last)
      await signer.sendTransaction({
        to: msg.sender,
        value: amount
      });
    });
  }
}
```

**Checks-Effects-Interactions Pattern**:
```solidity
// Solidity example showing correct pattern
contract SecureVault {
    mapping(address => uint256) public balances;

    function withdraw(uint256 amount) external nonReentrant {
        // CHECKS - validate conditions
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // EFFECTS - update state
        balances[msg.sender] -= amount;

        // INTERACTIONS - external calls LAST
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

---

### 2.4 Oracle Manipulation & Flash Loan Attacks

**Severity**: CRITICAL
**Impact**: Over $100M stolen in 2021-2024

**Attack Pattern**:
1. Attacker takes flash loan (millions of dollars, no collateral)
2. Manipulates DEX price (oracle uses this DEX)
3. Exploits protocol using manipulated price
4. Repays flash loan
5. Keeps profit

**Prevention**:
```typescript
// Time-Weighted Average Price (TWAP) Oracle
class TWAPOracle {
  private priceHistory: Array<{ price: bigint; timestamp: number }> = [];
  private windowSize = 3600; // 1 hour

  async updatePrice(price: bigint): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Add new price
    this.priceHistory.push({ price, timestamp: now });

    // Remove old prices outside window
    this.priceHistory = this.priceHistory.filter(
      p => p.timestamp > now - this.windowSize
    );
  }

  async getTWAP(): Promise<bigint> {
    if (this.priceHistory.length === 0) {
      throw new Error('No price data available');
    }

    // Calculate time-weighted average
    let totalWeightedPrice = 0n;
    let totalTime = 0n;

    for (let i = 1; i < this.priceHistory.length; i++) {
      const timeDiff = BigInt(
        this.priceHistory[i].timestamp - this.priceHistory[i - 1].timestamp
      );
      const weightedPrice = this.priceHistory[i - 1].price * timeDiff;

      totalWeightedPrice += weightedPrice;
      totalTime += timeDiff;
    }

    if (totalTime === 0n) return this.priceHistory[0].price;

    return totalWeightedPrice / totalTime;
  }
}

// Chainlink decentralized oracle (RECOMMENDED)
class ChainlinkOracle {
  private aggregator: AggregatorV3Interface;

  async getPrice(): Promise<bigint> {
    const roundData = await this.aggregator.latestRoundData();

    // Validate data freshness
    const now = Math.floor(Date.now() / 1000);
    if (now - roundData.updatedAt > 3600) {
      throw new Error('Oracle data is stale');
    }

    // Validate price is reasonable
    if (roundData.answer <= 0) {
      throw new Error('Invalid oracle price');
    }

    return BigInt(roundData.answer);
  }

  // Use multiple oracles for critical operations
  async getPriceWithConsensus(
    oracles: ChainlinkOracle[]
  ): Promise<bigint> {
    if (oracles.length < 3) {
      throw new Error('Minimum 3 oracles required');
    }

    const prices = await Promise.all(
      oracles.map(o => o.getPrice())
    );

    // Calculate median (resistant to outliers)
    const sorted = [...prices].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    );

    return sorted[Math.floor(sorted.length / 2)];
  }
}
```

**Flash Loan Prevention**:
```typescript
// Detect and block flash loan attacks
class FlashLoanDefense {
  private balanceAtBlockStart = new Map<string, bigint>();

  async checkForFlashLoan(address: string): Promise<void> {
    const currentBalance = await token.balanceOf(address);
    const startBalance = this.balanceAtBlockStart.get(address) || 0n;

    // If balance increased dramatically within same block
    const increase = currentBalance - startBalance;
    const percentIncrease = increase * 100n / (startBalance || 1n);

    if (percentIncrease > 1000n) { // 1000% increase
      throw new Error('Potential flash loan detected - transaction blocked');
    }
  }

  // Store balance at start of block
  async recordBalance(address: string): Promise<void> {
    const balance = await token.balanceOf(address);
    this.balanceAtBlockStart.set(address, balance);
  }
}
```

---

## 3. Infrastructure Edge Cases

### 3.1 Nonce Management in Concurrent Transactions

**Description**: Multiple concurrent transactions from same address cause nonce collisions.

**Problem**: Nonces must increment exactly by one. If transaction with nonce N fails, all transactions with nonce N+1, N+2, etc. are stuck.

**Solution**:
```typescript
// Production-grade nonce manager
import Redis from 'ioredis';

class NonceManager {
  private redis: Redis;
  private locks = new Map<string, Promise<void>>();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async getNextNonce(address: string): Promise<number> {
    // Acquire lock for this address
    await this.acquireLock(address);

    try {
      // Get nonce from multiple sources
      const [chainNonce, redisNonce, pendingNonce] = await Promise.all([
        provider.getTransactionCount(address, 'latest'),
        this.getRedisNonce(address),
        provider.getTransactionCount(address, 'pending')
      ]);

      // Use highest nonce
      const nonce = Math.max(chainNonce, redisNonce, pendingNonce);

      // Store next nonce in Redis
      await this.setRedisNonce(address, nonce + 1);

      // Persist to database for recovery
      await this.persistNonce(address, nonce + 1);

      logger.info('Allocated nonce', { address, nonce });

      return nonce;
    } finally {
      this.releaseLock(address);
    }
  }

  private async acquireLock(address: string): Promise<void> {
    const lockKey = `nonce:lock:${address}`;
    const lockId = crypto.randomUUID();

    // Try to acquire lock with 30 second timeout
    while (true) {
      const acquired = await this.redis.set(
        lockKey,
        lockId,
        'PX', 30000, // 30 seconds
        'NX'        // Only set if not exists
      );

      if (acquired === 'OK') {
        break;
      }

      // Wait 100ms and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async releaseLock(address: string): Promise<void> {
    const lockKey = `nonce:lock:${address}`;
    await this.redis.del(lockKey);
  }

  // Sync with chain periodically
  async syncWithChain(address: string): Promise<void> {
    const chainNonce = await provider.getTransactionCount(address, 'pending');
    await this.setRedisNonce(address, chainNonce);
    logger.info('Synced nonce with chain', { address, chainNonce });
  }

  // Handle failed transactions
  async handleFailedTransaction(
    address: string,
    failedNonce: number
  ): Promise<void> {
    // Reset Redis nonce to failed nonce so it can be reused
    await this.setRedisNonce(address, failedNonce);
    logger.warn('Reset nonce due to failure', { address, failedNonce });
  }

  private async getRedisNonce(address: string): Promise<number> {
    const nonce = await this.redis.get(`nonce:${address}`);
    return nonce ? parseInt(nonce, 10) : 0;
  }

  private async setRedisNonce(address: string, nonce: number): Promise<void> {
    await this.redis.set(`nonce:${address}`, nonce.toString());
  }

  private async persistNonce(address: string, nonce: number): Promise<void> {
    await db.query(
      'INSERT INTO nonces (address, nonce) VALUES ($1, $2) ' +
      'ON CONFLICT (address) DO UPDATE SET nonce = $2',
      [address, nonce]
    );
  }
}
```

**Queue-Based Transaction Management**:
```typescript
// Queue transactions to ensure ordering
class TransactionQueue {
  private queue: Array<QueuedTransaction> = [];
  private processing = false;

  async add(tx: TransactionRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ tx, resolve, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];

      try {
        const nonce = await nonceManager.getNextNonce(signer.address);
        const txResponse = await signer.sendTransaction({
          ...item.tx,
          nonce
        });

        // Wait for confirmation
        const receipt = await txResponse.wait();

        item.resolve(receipt.hash);
        this.queue.shift(); // Remove from queue
      } catch (error) {
        item.reject(error);
        this.queue.shift();
      }
    }

    this.processing = false;
  }
}
```

---

### 3.2 RPC Rate Limiting

**Description**: RPC providers limit requests (typically 5-10 req/sec for free tier).

**Problem**: Hitting rate limits causes 429 errors and request failures.

**Solution**:
```typescript
// Rate limiter with exponential backoff
import pRetry from 'p-retry';
import Bottleneck from 'bottleneck';

class RateLimitedProvider {
  private limiter: Bottleneck;
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string, requestsPerSecond: number = 5) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Configure rate limiter
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 1000 / requestsPerSecond, // Spread requests evenly
      reservoir: requestsPerSecond * 5, // Burst capacity
      reservoirRefreshAmount: requestsPerSecond,
      reservoirRefreshInterval: 1000 // Refill every second
    });
  }

  async request(method: string, params: any[]): Promise<any> {
    return this.limiter.schedule(() =>
      pRetry(
        async () => {
          return await this.provider.send(method, params);
        },
        {
          retries: 5,
          onFailedAttempt: (error) => {
            if (error.message.includes('429')) {
              // Rate limited - wait longer
              logger.warn('Rate limited, attempt', error.attemptNumber);
              return;
            }
            throw error; // Don't retry other errors
          },
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 30000
        }
      )
    );
  }

  // Batch requests to reduce total calls
  async batchRequest(calls: Array<{ method: string; params: any[] }>): Promise<any[]> {
    return this.limiter.schedule(async () => {
      const batch = calls.map((call, id) => ({
        jsonrpc: '2.0',
        id,
        method: call.method,
        params: call.params
      }));

      const response = await fetch(this.provider._getConnection().url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch)
      });

      return await response.json();
    });
  }
}
```

**Multi-Provider Failover**:
```typescript
// Use multiple providers with automatic failover
class MultiProvider {
  private providers: Array<{ provider: ethers.JsonRpcProvider; priority: number }>;
  private currentIndex = 0;

  constructor(rpcUrls: string[]) {
    this.providers = rpcUrls.map((url, index) => ({
      provider: new ethers.JsonRpcProvider(url),
      priority: index
    }));
  }

  async request(method: string, params: any[]): Promise<any> {
    let lastError: Error | null = null;

    // Try each provider in order
    for (let i = 0; i < this.providers.length; i++) {
      const index = (this.currentIndex + i) % this.providers.length;
      const { provider } = this.providers[index];

      try {
        const result = await provider.send(method, params);
        this.currentIndex = index; // Remember working provider
        return result;
      } catch (error) {
        logger.warn(`Provider ${index} failed`, error);
        lastError = error as Error;
        continue; // Try next provider
      }
    }

    throw new Error(`All providers failed: ${lastError?.message}`);
  }
}
```

---

## 4. Cross-Chain Bridge Edge Cases

### 4.1 Private Key Compromises (Bridge Edition)

**Severity**: CRITICAL
**Impact**: Orbit Chain January 2024 - $3M lost (7 of 10 multisig keys compromised)

**Prevention**:
```typescript
// Enhanced multisig with time delays
class TimelockMultisig {
  async proposeBridgeTransfer(
    amount: bigint,
    destination: string,
    chain: string
  ): Promise<string> {
    const proposalId = crypto.randomUUID();

    // Create proposal with timelock
    await db.query(
      'INSERT INTO proposals (id, amount, destination, chain, created_at, execute_after) ' +
      'VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL \'24 hours\')',
      [proposalId, amount.toString(), destination, chain]
    );

    logger.info('Bridge transfer proposed', { proposalId, amount, chain });

    return proposalId;
  }

  async executeProposal(proposalId: string, signatures: string[]): Promise<void> {
    const proposal = await db.query(
      'SELECT * FROM proposals WHERE id = $1',
      [proposalId]
    );

    if (!proposal.rows[0]) {
      throw new Error('Proposal not found');
    }

    // Check timelock
    if (new Date() < proposal.rows[0].execute_after) {
      throw new Error('Timelock not expired');
    }

    // Verify signatures (requires 7 of 10)
    const validSignatures = signatures.filter(sig =>
      this.verifySignature(sig, proposalId)
    );

    if (validSignatures.length < 7) {
      throw new Error('Insufficient signatures');
    }

    // Execute transfer
    await this.bridgeTransfer(proposal.rows[0]);
  }
}
```

---

### 4.2 Fake Deposit Events

**Description**: Attacker generates deposit event without real deposit.

**Prevention**:
```typescript
// Verify deposits with multiple confirmations
class SecureBridgeValidator {
  async validateDeposit(
    txHash: string,
    sourceChain: string,
    amount: bigint,
    token: string
  ): Promise<boolean> {
    // 1. Verify transaction exists and is confirmed
    const receipt = await sourceProvider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction not found or failed');
    }

    // 2. Wait for deep confirmations
    const currentBlock = await sourceProvider.getBlockNumber();
    if (currentBlock - receipt.blockNumber < 128) {
      throw new Error('Insufficient confirmations');
    }

    // 3. Verify deposit event in logs
    const depositEvent = receipt.logs.find(log =>
      log.topics[0] === DEPOSIT_EVENT_SIGNATURE &&
      log.address.toLowerCase() === BRIDGE_CONTRACT.toLowerCase()
    );

    if (!depositEvent) {
      throw new Error('Deposit event not found');
    }

    // 4. Decode and verify amount
    const decoded = bridgeInterface.parseLog(depositEvent);
    if (decoded.args.amount !== amount || decoded.args.token !== token) {
      throw new Error('Deposit amount/token mismatch');
    }

    // 5. Check if already processed (prevent double-spending)
    const isProcessed = await db.query(
      'SELECT 1 FROM processed_deposits WHERE tx_hash = $1',
      [txHash]
    );

    if (isProcessed.rows.length > 0) {
      throw new Error('Deposit already processed');
    }

    // 6. Verify token balance actually increased
    const currentBalance = await token.balanceOf(BRIDGE_CONTRACT);
    const expectedBalance = (await this.getHistoricalBalance(
      token.address,
      receipt.blockNumber - 1
    )) + amount;

    if (currentBalance < expectedBalance) {
      throw new Error('Bridge balance did not increase as expected');
    }

    // Mark as processed
    await db.query(
      'INSERT INTO processed_deposits (tx_hash, amount, token, processed_at) ' +
      'VALUES ($1, $2, $3, NOW())',
      [txHash, amount.toString(), token]
    );

    return true;
  }
}
```

---

## 5. Solana-Specific Edge Cases

### 5.1 Blockhash Expiration

**Description**: Solana transactions expire after 151 blocks (~79 seconds).

**Edge Cases**:
- RPC node lagging behind network
- User delays in signing
- Commitment level mismatches
- RPC pool desynchronization

**Solution**:
```typescript
// Robust blockhash management
class SolanaTransactionManager {
  async sendTransaction(
    transaction: Transaction,
    options: { maxRetries?: number; commitment?: Commitment } = {}
  ): Promise<string> {
    const { maxRetries = 3, commitment = 'confirmed' } = options;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get fresh blockhash
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash(commitment);

        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;

        // Sign and send
        const signature = await connection.sendTransaction(transaction, [signer]);

        // Confirm with block height tracking
        const confirmation = await this.confirmTransaction(
          signature,
          lastValidBlockHeight,
          commitment
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        return signature;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;

        logger.warn(`Transaction attempt ${attempt + 1} failed`, error);

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('Transaction failed after all retries');
  }

  private async confirmTransaction(
    signature: string,
    lastValidBlockHeight: number,
    commitment: Commitment
  ): Promise<RpcResponseAndContext<SignatureStatus>> {
    let blockHeight = await connection.getBlockHeight(commitment);

    while (blockHeight <= lastValidBlockHeight) {
      // Check transaction status
      const status = await connection.getSignatureStatus(signature);

      if (status.value !== null) {
        return status;
      }

      // Transaction not found yet, wait for next block
      await new Promise(resolve => setTimeout(resolve, 500));
      blockHeight = await connection.getBlockHeight(commitment);
    }

    throw new Error('Transaction expired - blockhash no longer valid');
  }

  // Use durable nonces for offline signing
  async createDurableTransaction(
    instruction: TransactionInstruction
  ): Promise<Transaction> {
    // Create nonce account (one-time setup)
    const nonceAccount = Keypair.generate();
    const nonceAuthority = signer.publicKey;

    // Advance nonce instruction
    const advanceInstruction = SystemProgram.nonceAdvance({
      noncePubkey: nonceAccount.publicKey,
      authorizedPubkey: nonceAuthority
    });

    // Get durable blockhash from nonce account
    const nonceAccountInfo = await connection.getAccountInfo(nonceAccount.publicKey);
    const nonceAccountData = NonceAccount.fromAccountData(nonceAccountInfo.data);

    const transaction = new Transaction();
    transaction.recentBlockhash = nonceAccountData.nonce;
    transaction.add(advanceInstruction);
    transaction.add(instruction);

    // This transaction never expires!
    return transaction;
  }
}
```

---

### 5.2 Commitment Level Edge Cases

**Description**: Different commitment levels can cause transaction validation issues.

**Solution**:
```typescript
// Consistent commitment level strategy
class CommitmentStrategy {
  // Use 'confirmed' for most operations (best balance)
  async getBalance(address: PublicKey): Promise<number> {
    return await connection.getBalance(address, 'confirmed');
  }

  // Use 'finalized' for high-value operations (secure but slower)
  async confirmHighValueTransfer(signature: string): Promise<void> {
    const status = await connection.confirmTransaction(signature, 'finalized');

    if (status.value.err) {
      throw new Error('Transaction failed');
    }

    // Double-check with 'finalized' commitment
    const finalizedStatus = await connection.getSignatureStatus(signature);

    if (finalizedStatus.value?.confirmationStatus !== 'finalized') {
      throw new Error('Transaction not finalized');
    }
  }

  // Avoid 'processed' commitment (can be on minority fork)
  // Only use for UI updates, never for transaction logic
}
```

---

## 6. MCP Server Edge Cases

### 6.1 Server Disconnection & Reconnection

**Prevention**:
```typescript
// Auto-reconnecting MCP client
class ResilientMCPClient {
  private client: MCPClient;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  async connect(): Promise<void> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        await this.client.connect();
        this.reconnectAttempts = 0; // Reset on success
        logger.info('MCP client connected');
        return;
      } catch (error) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        logger.warn(`Connection attempt ${this.reconnectAttempts} failed, retrying in ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Failed to connect after maximum attempts');
  }

  async callTool(name: string, args: any): Promise<any> {
    try {
      return await this.client.callTool({ name, arguments: args });
    } catch (error) {
      if (this.isConnectionError(error)) {
        logger.warn('Connection lost, attempting reconnect');
        await this.connect();

        // Retry the call
        return await this.client.callTool({ name, arguments: args });
      }
      throw error;
    }
  }

  private isConnectionError(error: any): boolean {
    return error.message.includes('ECONNREFUSED') ||
           error.message.includes('ENOTFOUND') ||
           error.message.includes('ETIMEDOUT');
  }
}
```

---

### 6.2 Tool-Level Error Handling

**Pattern**: Errors should be returned in result, not as protocol errors.

```typescript
// Correct tool implementation
class MCPTool {
  async executeTool(name: string, args: any): Promise<ToolResult> {
    try {
      // Validate inputs
      const validated = this.validateArgs(name, args);

      // Execute tool logic
      const result = await this.execute(name, validated);

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now(),
          toolVersion: '1.0.0'
        }
      };
    } catch (error) {
      // Return error as tool result (LLM can see and handle)
      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: error.message,
          details: error.stack,
          suggestion: this.getSuggestion(error)
        }
      };
    }
  }

  private getSuggestion(error: Error): string {
    if (error.message.includes('insufficient funds')) {
      return 'Check wallet balance and ensure sufficient funds for gas fees';
    }

    if (error.message.includes('nonce')) {
      return 'Nonce collision detected - transaction queue may be backed up';
    }

    if (error.message.includes('gas')) {
      return 'Gas estimation failed - try increasing gas limit by 20%';
    }

    return 'Review error details and try again';
  }
}
```

---

## 7. Memory & Resource Management

### 7.1 WebSocket Connection Leaks

**Problem**: WebSocket connections not properly closed cause memory leaks.

**Solution**:
```typescript
// Proper WebSocket lifecycle management
class ManagedWebSocketProvider {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private eventListeners = new Map<string, Set<Function>>();

  async connect(url: string): Promise<void> {
    // Clean up existing connection
    if (this.ws) {
      await this.disconnect();
    }

    this.ws = new WebSocket(url);

    // Set up ping/pong for connection health
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds

    // Track listeners for cleanup
    this.ws.on('message', this.handleMessage.bind(this));
    this.ws.on('error', this.handleError.bind(this));
    this.ws.on('close', this.handleClose.bind(this));
  }

  async disconnect(): Promise<void> {
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Remove all event listeners
    if (this.ws) {
      this.ws.removeAllListeners();

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }

      this.ws = null;
    }

    // Clear tracked listeners
    this.eventListeners.clear();

    logger.info('WebSocket disconnected and cleaned up');
  }

  // Ensure cleanup on process exit
  setupProcessHandlers(): void {
    const cleanup = async () => {
      await this.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('beforeExit', cleanup);
  }
}
```

---

### 7.2 Provider Connection Pool Exhaustion

**Solution**:
```typescript
// Connection pool with limits
class ProviderPool {
  private pool: ethers.JsonRpcProvider[] = [];
  private activeConnections = 0;
  private maxConnections = 10;
  private waitQueue: Array<(provider: ethers.JsonRpcProvider) => void> = [];

  async acquire(): Promise<ethers.JsonRpcProvider> {
    // Reuse existing provider if available
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    // Create new if under limit
    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      return new ethers.JsonRpcProvider(RPC_URL);
    }

    // Wait for available provider
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(provider: ethers.JsonRpcProvider): void {
    // Give to waiting request
    const waiting = this.waitQueue.shift();
    if (waiting) {
      waiting(provider);
      return;
    }

    // Return to pool
    this.pool.push(provider);
  }

  async use<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
    const provider = await this.acquire();
    try {
      return await fn(provider);
    } finally {
      this.release(provider);
    }
  }

  async drain(): Promise<void> {
    // Close all providers
    for (const provider of this.pool) {
      provider.destroy();
    }
    this.pool = [];
    this.activeConnections = 0;
  }
}
```

---

## 8. Cache Invalidation Edge Cases

### 8.1 Stale Blockchain Data

**Problem**: Cached balances/prices become stale after on-chain events.

**Solution**:
```typescript
// Event-driven cache invalidation
class SmartCache {
  private cache = new Map<string, CacheEntry>();
  private subscriptions = new Map<string, any>();

  async getBalance(address: string): Promise<bigint> {
    const cacheKey = `balance:${address}`;
    const cached = this.cache.get(cacheKey);

    // Check cache freshness (30 seconds max)
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.value;
    }

    // Fetch fresh value
    const balance = await provider.getBalance(address);

    // Cache and subscribe to changes
    this.cache.set(cacheKey, {
      value: balance,
      timestamp: Date.now()
    });

    // Subscribe to Transfer events for this address
    if (!this.subscriptions.has(address)) {
      this.subscribeToAddress(address);
    }

    return balance;
  }

  private subscribeToAddress(address: string): void {
    // Listen for Transfer events affecting this address
    const filter = {
      topics: [
        ethers.id('Transfer(address,address,uint256)'),
        [ethers.zeroPadValue(address, 32), null], // from
        [null, ethers.zeroPadValue(address, 32)]  // to
      ]
    };

    const subscription = provider.on(filter, (log) => {
      // Invalidate cache immediately
      const cacheKey = `balance:${address}`;
      this.cache.delete(cacheKey);
      logger.info('Cache invalidated due to Transfer event', { address });
    });

    this.subscriptions.set(address, subscription);
  }

  cleanup(): void {
    // Remove all subscriptions
    for (const [address, subscription] of this.subscriptions) {
      provider.off(subscription);
    }
    this.subscriptions.clear();
    this.cache.clear();
  }
}
```

---

## Testing Recommendations

### Edge Case Test Suite

```typescript
// Comprehensive edge case testing
describe('Edge Case Test Suite', () => {
  describe('Blockchain Edge Cases', () => {
    it('should handle chain reorgs', async () => {
      // Test reorg detection and recovery
    });

    it('should detect MEV sandwich attacks', async () => {
      // Test sandwich detection
    });

    it('should handle gas price spikes', async () => {
      // Test gas price ceiling enforcement
    });
  });

  describe('Nonce Management', () => {
    it('should handle 100 concurrent transactions', async () => {
      const promises = Array(100).fill(null).map(() =>
        sendTransaction({ to: address, value: parseEther('0.001') })
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBe(100);
    });

    it('should recover from failed transaction', async () => {
      // Test nonce recovery after failure
    });
  });

  describe('Security', () => {
    it('should reject reentrancy attacks', async () => {
      await expect(reentrantCall()).rejects.toThrow('Reentrant call detected');
    });

    it('should validate all inputs', async () => {
      await expect(
        sendTransaction({ to: 'invalid', value: '-1' })
      ).rejects.toThrow();
    });

    it('should prevent integer overflow', async () => {
      const huge = BigInt(2) ** BigInt(256);
      await expect(transfer(huge)).rejects.toThrow('overflow');
    });
  });

  describe('Solana Edge Cases', () => {
    it('should handle blockhash expiration', async () => {
      // Test blockhash refresh and retry
    });

    it('should handle commitment mismatches', async () => {
      // Test commitment level consistency
    });
  });

  describe('MCP Server', () => {
    it('should reconnect after disconnection', async () => {
      // Simulate server disconnect
      await mcpServer.stop();

      // Should auto-reconnect
      const result = await mcpClient.callTool('query_balance', { address });
      expect(result).toBeDefined();
    });

    it('should return errors in tool results', async () => {
      const result = await mcpClient.callTool('invalid_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
```

---

## Monitoring & Alerting

```typescript
// Edge case monitoring system
class EdgeCaseMonitor {
  async checkSystem(): Promise<HealthReport> {
    const checks = await Promise.all([
      this.checkGasPrice(),
      this.checkNonceSync(),
      this.checkMCPHealth(),
      this.checkMemoryUsage(),
      this.checkRPCLatency()
    ]);

    const criticalIssues = checks.filter(c => c.level === 'CRITICAL');
    const warnings = checks.filter(c => c.level === 'WARNING');

    if (criticalIssues.length > 0) {
      await this.sendAlert('CRITICAL', criticalIssues);
    }

    return {
      status: criticalIssues.length > 0 ? 'UNHEALTHY' : 'HEALTHY',
      checks,
      timestamp: Date.now()
    };
  }

  private async checkGasPrice(): Promise<HealthCheck> {
    const gasPrice = await provider.getGasPrice();
    const gwei = parseFloat(formatUnits(gasPrice, 'gwei'));

    if (gwei > 500) {
      return {
        name: 'Gas Price',
        level: 'CRITICAL',
        message: `Gas price ${gwei} gwei exceeds maximum threshold`,
        action: 'Pause non-essential transactions'
      };
    }

    if (gwei > 200) {
      return {
        name: 'Gas Price',
        level: 'WARNING',
        message: `Gas price ${gwei} gwei is high`,
        action: 'Monitor gas prices closely'
      };
    }

    return {
      name: 'Gas Price',
      level: 'OK',
      message: `Gas price ${gwei} gwei is acceptable`
    };
  }

  private async checkNonceSync(): Promise<HealthCheck> {
    const address = signer.address;
    const [chainNonce, redisNonce] = await Promise.all([
      provider.getTransactionCount(address, 'pending'),
      nonceManager.getRedisNonce(address)
    ]);

    const diff = Math.abs(chainNonce - redisNonce);

    if (diff > 5) {
      return {
        name: 'Nonce Sync',
        level: 'CRITICAL',
        message: `Nonce desync: chain=${chainNonce}, redis=${redisNonce}`,
        action: 'Sync nonces immediately'
      };
    }

    return { name: 'Nonce Sync', level: 'OK', message: 'Nonces in sync' };
  }

  private async sendAlert(level: string, issues: HealthCheck[]): Promise<void> {
    // Send to monitoring service (PagerDuty, Slack, etc.)
    await fetch('https://monitoring.example.com/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, issues, timestamp: Date.now() })
    });
  }
}
```

---

## Summary: Critical Edge Cases Priority Matrix

| Edge Case | Severity | Likelihood | Priority | Mitigation Effort |
|-----------|----------|------------|----------|------------------|
| Private Key Compromise | CRITICAL | Medium | 🔥 P0 | High |
| Reentrancy Attack | CRITICAL | Medium | 🔥 P0 | Low |
| Oracle Manipulation | CRITICAL | Medium | 🔥 P0 | Medium |
| Nonce Collision | HIGH | High | ⚠️ P1 | Medium |
| Blockhash Expiration (Solana) | HIGH | High | ⚠️ P1 | Low |
| RPC Rate Limiting | HIGH | Very High | ⚠️ P1 | Low |
| Chain Reorg | HIGH | Low | ⚠️ P1 | Medium |
| MEV Sandwich | MEDIUM | High | 📋 P2 | High |
| Gas Price Spike | MEDIUM | Medium | 📋 P2 | Low |
| WebSocket Leak | MEDIUM | Medium | 📋 P2 | Low |
| Cache Staleness | LOW | High | 📋 P3 | Low |

---

**Document Status**: Production-Ready
**Implementation Priority**: Follow P0 → P1 → P2 → P3
**Testing Coverage**: All edge cases must have automated tests
**Review Frequency**: Monthly or after any security incident
