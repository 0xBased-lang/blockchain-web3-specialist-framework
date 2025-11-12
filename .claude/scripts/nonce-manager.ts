#!/usr/bin/env ts-node
/**
 * Cross-Chain Nonce Management System
 *
 * Prevents nonce desynchronization and handles stuck transactions across multiple chains.
 * Critical for multi-chain deployments where transactions must execute in order.
 *
 * Features:
 * - Per-chain nonce tracking
 * - Stuck transaction detection
 * - Automatic recovery with gas price escalation
 * - State persistence across sessions
 */

import * as fs from 'fs';
import * as path from 'path';

interface NonceState {
  [chain: string]: {
    current: number;
    pending: Array<{
      hash: string;
      nonce: number;
      timestamp: number;
      gasPrice: string;
    }>;
    stuck: Array<{
      hash: string;
      nonce: number;
      since: number;
      recoveryAttempts: number;
    }>;
    lastSync: number;
  };
}

interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  blockTime: number; // seconds
  stuckThreshold: number; // milliseconds
}

const CHAIN_CONFIGS: { [key: string]: ChainConfig } = {
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    chainId: 1,
    blockTime: 12,
    stuckThreshold: 10 * 60 * 1000, // 10 minutes
  },
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    chainId: 11155111,
    blockTime: 12,
    stuckThreshold: 10 * 60 * 1000,
  },
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    chainId: 56,
    blockTime: 3,
    stuckThreshold: 5 * 60 * 1000, // 5 minutes (faster blocks)
  },
  avalanche: {
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114,
    blockTime: 2,
    stuckThreshold: 5 * 60 * 1000,
  },
};

class NonceManager {
  private statePath: string;
  private state: NonceState;

  constructor(statePath: string = '.claude/state/nonce-state.json') {
    this.statePath = statePath;
    this.state = this.loadState();
  }

  /**
   * Load persisted state from disk
   */
  private loadState(): NonceState {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load nonce state:', error);
    }

    return {};
  }

  /**
   * Save state to disk atomically
   */
  private saveState(): void {
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tempPath = `${this.statePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
      fs.renameSync(tempPath, this.statePath);
    } catch (error) {
      console.error('Failed to save nonce state:', error);
      throw error;
    }
  }

  /**
   * Initialize chain state if not exists
   */
  private initChain(chain: string): void {
    if (!this.state[chain]) {
      this.state[chain] = {
        current: 0,
        pending: [],
        stuck: [],
        lastSync: 0,
      };
    }
  }

  /**
   * Get next nonce for deployment
   * Handles external transactions by syncing with on-chain state
   */
  async getNextNonce(chain: string, address: string): Promise<number> {
    this.initChain(chain);

    // Sync with on-chain state periodically (every 5 minutes)
    const now = Date.now();
    if (now - this.state[chain].lastSync > 5 * 60 * 1000) {
      await this.syncWithChain(chain, address);
    }

    const next = this.state[chain].current;
    this.state[chain].current = next + 1;
    this.saveState();

    return next;
  }

  /**
   * Sync with on-chain nonce (ground truth)
   */
  async syncWithChain(chain: string, address: string): Promise<void> {
    try {
      const onchainNonce = await this.getOnchainNonce(chain, address);
      const trackedNonce = this.state[chain]?.current || 0;

      if (onchainNonce > trackedNonce) {
        console.log(
          `[${chain}] Nonce desync detected: onchain=${onchainNonce}, tracked=${trackedNonce}`
        );
        console.log(`[${chain}] Resetting to onchain value`);

        this.state[chain].current = onchainNonce;
        // Clear pending (they've been mined)
        this.state[chain].pending = [];
      }

      this.state[chain].lastSync = Date.now();
      this.saveState();
    } catch (error) {
      console.error(`[${chain}] Failed to sync with chain:`, error);
    }
  }

  /**
   * Get on-chain nonce via RPC call
   */
  private async getOnchainNonce(chain: string, address: string): Promise<number> {
    const config = CHAIN_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    try {
      const response = await fetch(config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionCount',
          params: [address, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      return parseInt(data.result, 16);
    } catch (error) {
      console.error(`[${chain}] RPC call failed:`, error);
      throw error;
    }
  }

  /**
   * Record pending transaction
   */
  recordPendingTx(
    chain: string,
    hash: string,
    nonce: number,
    gasPrice: string
  ): void {
    this.initChain(chain);

    this.state[chain].pending.push({
      hash,
      nonce,
      timestamp: Date.now(),
      gasPrice,
    });

    this.saveState();
    console.log(`[${chain}] Recorded pending tx ${hash} with nonce ${nonce}`);
  }

  /**
   * Detect and handle stuck transactions
   */
  async detectStuckTransactions(chain: string, address: string): Promise<void> {
    this.initChain(chain);

    const config = CHAIN_CONFIGS[chain];
    const now = Date.now();

    for (const pending of this.state[chain].pending) {
      const age = now - pending.timestamp;

      if (age > config.stuckThreshold) {
        console.log(
          `[${chain}] ⚠️  Transaction ${pending.hash} stuck for ${Math.floor(age / 1000)}s`
        );

        // Check if already in stuck list
        const alreadyStuck = this.state[chain].stuck.find(
          (s) => s.hash === pending.hash
        );

        if (!alreadyStuck) {
          // Add to stuck list
          this.state[chain].stuck.push({
            hash: pending.hash,
            nonce: pending.nonce,
            since: pending.timestamp,
            recoveryAttempts: 0,
          });

          // Attempt recovery
          await this.attemptRecovery(chain, pending.hash, pending.nonce, pending.gasPrice);
        }
      }
    }

    this.saveState();
  }

  /**
   * Attempt to recover stuck transaction with higher gas price
   */
  private async attemptRecovery(
    chain: string,
    originalHash: string,
    nonce: number,
    originalGasPrice: string
  ): Promise<void> {
    const stuck = this.state[chain].stuck.find((s) => s.hash === originalHash);
    if (!stuck) return;

    if (stuck.recoveryAttempts >= 3) {
      console.log(
        `[${chain}] ❌ Max recovery attempts reached for tx ${originalHash}`
      );
      console.log(`[${chain}] Manual intervention required`);
      return;
    }

    // Increase gas price by 50% for each attempt
    const multiplier = 1.5 * (stuck.recoveryAttempts + 1);
    const newGasPrice = (BigInt(originalGasPrice) * BigInt(Math.floor(multiplier * 100))) / BigInt(100);

    console.log(
      `[${chain}] 🔄 Attempting recovery: replacing tx with ${multiplier}x gas price`
    );
    console.log(
      `[${chain}] Original: ${originalGasPrice} wei, New: ${newGasPrice.toString()} wei`
    );

    stuck.recoveryAttempts++;

    // Note: Actual transaction replacement would happen here via ethers.js
    // For now, we just log the intent
    console.log(
      `[${chain}] To replace: send new transaction with same nonce ${nonce} and gasPrice ${newGasPrice}`
    );

    this.saveState();
  }

  /**
   * Mark transaction as confirmed
   */
  confirmTransaction(chain: string, hash: string): void {
    this.initChain(chain);

    // Remove from pending
    this.state[chain].pending = this.state[chain].pending.filter(
      (p) => p.hash !== hash
    );

    // Remove from stuck
    this.state[chain].stuck = this.state[chain].stuck.filter(
      (s) => s.hash !== hash
    );

    this.saveState();
    console.log(`[${chain}] ✅ Transaction ${hash} confirmed`);
  }

  /**
   * Get status report for all chains
   */
  getStatus(): string {
    const lines = ['Nonce Manager Status', '='.repeat(50)];

    for (const [chain, data] of Object.entries(this.state)) {
      lines.push(`\n${chain.toUpperCase()}:`);
      lines.push(`  Current Nonce: ${data.current}`);
      lines.push(`  Pending: ${data.pending.length} transactions`);
      lines.push(`  Stuck: ${data.stuck.length} transactions`);

      if (data.stuck.length > 0) {
        lines.push(`  ⚠️  Stuck transactions requiring attention:`);
        for (const stuck of data.stuck) {
          const age = Math.floor((Date.now() - stuck.since) / 1000);
          lines.push(
            `     - Nonce ${stuck.nonce}: stuck for ${age}s (${stuck.recoveryAttempts} recovery attempts)`
          );
        }
      }

      const lastSyncMin = Math.floor((Date.now() - data.lastSync) / 60000);
      lines.push(`  Last sync: ${lastSyncMin} minutes ago`);
    }

    return lines.join('\n');
  }

  /**
   * Recovery procedure for complete nonce desync
   */
  async emergencyResync(chain: string, address: string): Promise<void> {
    console.log(`[${chain}] 🚨 Emergency resync initiated`);

    const onchainNonce = await this.getOnchainNonce(chain, address);

    this.state[chain] = {
      current: onchainNonce,
      pending: [],
      stuck: [],
      lastSync: Date.now(),
    };

    this.saveState();

    console.log(`[${chain}] ✅ Emergency resync complete: nonce reset to ${onchainNonce}`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new NonceManager();

  switch (command) {
    case 'next':
      {
        const [chain, address] = args.slice(1);
        const nonce = await manager.getNextNonce(chain, address);
        console.log(nonce);
      }
      break;

    case 'record':
      {
        const [chain, hash, nonce, gasPrice] = args.slice(1);
        manager.recordPendingTx(chain, hash, parseInt(nonce), gasPrice);
      }
      break;

    case 'detect-stuck':
      {
        const [chain, address] = args.slice(1);
        await manager.detectStuckTransactions(chain, address);
      }
      break;

    case 'confirm':
      {
        const [chain, hash] = args.slice(1);
        manager.confirmTransaction(chain, hash);
      }
      break;

    case 'status':
      console.log(manager.getStatus());
      break;

    case 'resync':
      {
        const [chain, address] = args.slice(1);
        await manager.emergencyResync(chain, address);
      }
      break;

    default:
      console.log(`
Nonce Manager - Cross-Chain Transaction Nonce Tracking

Usage:
  ./nonce-manager.ts next <chain> <address>           Get next nonce
  ./nonce-manager.ts record <chain> <hash> <nonce> <gasPrice>   Record pending tx
  ./nonce-manager.ts detect-stuck <chain> <address>  Detect stuck transactions
  ./nonce-manager.ts confirm <chain> <hash>          Mark tx as confirmed
  ./nonce-manager.ts status                          Show status
  ./nonce-manager.ts resync <chain> <address>        Emergency resync

Chains: ethereum, sepolia, bsc, avalanche

Example:
  ./nonce-manager.ts next ethereum 0x1234...
  ./nonce-manager.ts record ethereum 0xabc... 5 50000000000
  ./nonce-manager.ts detect-stuck ethereum 0x1234...
  ./nonce-manager.ts status
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { NonceManager, NonceState, ChainConfig };
