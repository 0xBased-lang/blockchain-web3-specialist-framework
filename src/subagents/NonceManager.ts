/**
 * Nonce Manager
 *
 * Manages transaction nonces for Ethereum addresses.
 *
 * Features:
 * - Prevents nonce collisions in concurrent transactions
 * - Tracks pending transactions
 * - Automatic nonce recovery
 * - Lock-based synchronization
 *
 * CRITICAL: Proper nonce management prevents transaction failures
 */

import { JsonRpcProvider } from 'ethers';
import { type NonceState, TransactionError, TransactionErrorCode } from '../types/transaction.js';
import { logger } from '../utils/index.js';

/**
 * Nonce Manager
 *
 * Thread-safe nonce management for Ethereum transactions.
 * Prevents nonce collisions when sending multiple transactions concurrently.
 */
export class NonceManager {
  // Nonce state per address
  private readonly nonceStates: Map<string, NonceState>;

  // Lock system: address -> Promise that resolves when lock is released
  private readonly locks: Map<string, Promise<void>>;

  // Lock release functions
  private readonly lockReleases: Map<string, () => void>;

  // Provider for fetching chain nonces
  private readonly provider: JsonRpcProvider;

  // Configuration
  private readonly config: {
    syncInterval: number; // How often to sync with chain (ms)
    maxPendingDelta: number; // Max difference between pending and chain nonce
  };

  constructor(provider: JsonRpcProvider, config?: Partial<typeof NonceManager.DEFAULT_CONFIG>) {
    this.provider = provider;
    this.nonceStates = new Map();
    this.locks = new Map();
    this.lockReleases = new Map();
    this.config = { ...NonceManager.DEFAULT_CONFIG, ...config };

    logger.info('NonceManager initialized', { config: this.config });
  }

  static readonly DEFAULT_CONFIG = {
    syncInterval: 30000, // 30 seconds
    maxPendingDelta: 10, // Allow up to 10 pending transactions
  };

  /**
   * Get the next nonce for an address
   *
   * This method is thread-safe and prevents nonce collisions.
   *
   * @param address - Ethereum address
   * @param forceSync - Force sync with chain before returning
   * @returns Next available nonce
   */
  async getNextNonce(address: string, forceSync = false): Promise<number> {
    // Normalize address
    const normalizedAddress = address.toLowerCase();

    // Acquire lock for this address
    await this.acquireLock(normalizedAddress);

    try {
      // Get or initialize nonce state
      let state = this.nonceStates.get(normalizedAddress);

      if (!state || forceSync || this.shouldSync(state)) {
        // Fetch from chain
        const chainNonce = await this.fetchChainNonce(normalizedAddress);

        if (!state) {
          // Initialize new state
          state = {
            address: normalizedAddress,
            currentNonce: chainNonce,
            pendingNonce: chainNonce,
            lastUpdated: new Date(),
          };
          this.nonceStates.set(normalizedAddress, state);
        } else {
          // Update existing state
          // Use max to handle case where chain nonce is higher (transaction mined)
          state.currentNonce = Math.max(state.currentNonce, chainNonce);
          state.pendingNonce = Math.max(state.pendingNonce, chainNonce);
          state.lastUpdated = new Date();
        }

        logger.debug('Synced nonce with chain', {
          address: normalizedAddress,
          chainNonce,
          pendingNonce: state.pendingNonce,
        });
      }

      // Get next nonce
      const nextNonce = state.pendingNonce;

      // Increment pending nonce
      state.pendingNonce++;

      // Check if too many pending
      const pendingCount = state.pendingNonce - state.currentNonce;
      if (pendingCount > this.config.maxPendingDelta) {
        logger.warn('Too many pending transactions', {
          address: normalizedAddress,
          pendingCount,
          maxAllowed: this.config.maxPendingDelta,
        });

        throw new TransactionError(
          `Too many pending transactions: ${pendingCount}`,
          TransactionErrorCode.NONCE_TOO_HIGH,
          'ethereum'
        );
      }

      logger.debug('Assigned nonce', {
        address: normalizedAddress,
        nonce: nextNonce,
        pendingCount,
      });

      return nextNonce;
    } finally {
      // Always release lock
      this.releaseLock(normalizedAddress);
    }
  }

  /**
   * Mark a nonce as confirmed (transaction mined)
   *
   * @param address - Ethereum address
   * @param nonce - Confirmed nonce
   */
  confirmNonce(address: string, nonce: number): void {
    const normalizedAddress = address.toLowerCase();
    const state = this.nonceStates.get(normalizedAddress);

    if (state) {
      // Update current nonce to confirmed nonce + 1
      state.currentNonce = Math.max(state.currentNonce, nonce + 1);
      state.lastUpdated = new Date();

      logger.debug('Nonce confirmed', {
        address: normalizedAddress,
        nonce,
        currentNonce: state.currentNonce,
      });
    }
  }

  /**
   * Reset nonce state for an address
   *
   * Forces resync with chain on next nonce request.
   *
   * @param address - Ethereum address
   */
  resetNonce(address: string): void {
    const normalizedAddress = address.toLowerCase();
    this.nonceStates.delete(normalizedAddress);
    logger.info('Nonce state reset', { address: normalizedAddress });
  }

  /**
   * Get current nonce state for an address
   *
   * @param address - Ethereum address
   * @returns Nonce state or undefined
   */
  getNonceState(address: string): NonceState | undefined {
    return this.nonceStates.get(address.toLowerCase());
  }

  /**
   * Private helper methods
   */

  /**
   * Acquire lock for an address
   *
   * Waits if another operation is already holding the lock.
   *
   * @param address - Address to lock
   */
  private async acquireLock(address: string): Promise<void> {
    // Wait for existing lock if present
    while (this.locks.has(address)) {
      await this.locks.get(address);
    }

    // Create new lock
    let release: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(address, lockPromise);
    this.lockReleases.set(address, release);

    logger.debug('Lock acquired', { address });
  }

  /**
   * Release lock for an address
   *
   * @param address - Address to unlock
   */
  private releaseLock(address: string): void {
    const release = this.lockReleases.get(address);
    if (release) {
      release();
      this.locks.delete(address);
      this.lockReleases.delete(address);

      logger.debug('Lock released', { address });
    }
  }

  /**
   * Check if nonce state should be synced with chain
   *
   * @param state - Current nonce state
   * @returns True if should sync
   */
  private shouldSync(state: NonceState): boolean {
    const timeSinceUpdate = Date.now() - state.lastUpdated.getTime();
    return timeSinceUpdate > this.config.syncInterval;
  }

  /**
   * Fetch nonce from chain
   *
   * @param address - Ethereum address
   * @returns Chain nonce
   */
  private async fetchChainNonce(address: string): Promise<number> {
    try {
      // Use 'pending' to include pending transactions
      const nonce = await this.provider.getTransactionCount(address, 'pending');
      return nonce;
    } catch (error) {
      logger.error('Failed to fetch chain nonce', {
        address,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new TransactionError(
        'Failed to fetch nonce from chain',
        TransactionErrorCode.GAS_ESTIMATION_FAILED,
        'ethereum'
      );
    }
  }

  /**
   * Get statistics about nonce management
   *
   * @returns Nonce manager stats
   */
  getStats(): {
    trackedAddresses: number;
    totalPendingTransactions: number;
    activeLocks: number;
  } {
    let totalPending = 0;

    for (const state of this.nonceStates.values()) {
      totalPending += state.pendingNonce - state.currentNonce;
    }

    return {
      trackedAddresses: this.nonceStates.size,
      totalPendingTransactions: totalPending,
      activeLocks: this.locks.size,
    };
  }
}
