import { Connection, PublicKey, Commitment as SolanaCommitment } from '@solana/web3.js';
import pRetry from 'p-retry';
import { logger } from '../../utils/index.js';
import {
  SolanaError,
  SolanaErrorCode,
  type SolanaAddress,
  type Signature,
  type Blockhash,
  type Commitment,
  type AccountInfo,
  type BlockInfo,
  type TransactionInfo,
} from './types.js';

/**
 * Solana Provider
 *
 * Resilient Solana RPC provider with:
 * - Automatic retry with exponential backoff
 * - Recent blockhash caching (79 second expiration)
 * - Commitment level handling
 * - SPL token program support
 * - Rate limit handling
 *
 * Edge cases handled:
 * - RPC rate limiting → Retry with backoff
 * - Blockhash expiration → Auto-refresh
 * - Network timeouts → Multiple retries
 * - Account not found → Graceful error
 * - Commitment level mismatches → Proper defaults
 */
export class SolanaProvider {
  private connection: Connection;
  private cachedBlockhash: { blockhash: Blockhash; lastValidBlockHeight: number } | null = null;
  private blockhashCacheTime: number = 0;
  private readonly BLOCKHASH_CACHE_MS = 60000; // 60 seconds (safe margin from 79s expiration)

  constructor(
    rpcUrl: string,
    cluster: string,
    private maxRetries: number = 3,
    private retryDelay: number = 1000
  ) {
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    logger.info('Solana provider initialized', {
      cluster,
      rpcUrl,
      maxRetries,
    });
  }

  /**
   * Get underlying connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Convert commitment level to Solana SDK format
   */
  private toSolanaCommitment(commitment?: Commitment): SolanaCommitment {
    return (commitment ?? 'confirmed') as SolanaCommitment;
  }

  /**
   * Get recent blockhash with caching
   *
   * ⚠️ CRITICAL: Solana blockhashes expire after ~79 seconds
   * This implementation caches for 60 seconds to provide safety margin
   */
  async getRecentBlockhash(
    commitment: Commitment = 'confirmed'
  ): Promise<{ blockhash: Blockhash; lastValidBlockHeight: number }> {
    const now = Date.now();

    // Return cached if still valid
    if (this.cachedBlockhash && now - this.blockhashCacheTime < this.BLOCKHASH_CACHE_MS) {
      logger.debug('Using cached blockhash', {
        age: now - this.blockhashCacheTime,
        blockhash: this.cachedBlockhash.blockhash,
      });
      return this.cachedBlockhash;
    }

    return pRetry(
      async () => {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(
          this.toSolanaCommitment(commitment)
        );

        this.cachedBlockhash = {
          blockhash: blockhash as Blockhash,
          lastValidBlockHeight,
        };
        this.blockhashCacheTime = Date.now();

        logger.debug('Fetched new blockhash', {
          blockhash,
          lastValidBlockHeight,
        });

        return this.cachedBlockhash;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Blockhash fetch failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            { error: String(error) }
          );
        },
      }
    );
  }

  /**
   * Get account info
   */
  async getAccountInfo(
    address: SolanaAddress,
    commitment: Commitment = 'confirmed'
  ): Promise<AccountInfo | null> {
    return pRetry(
      async () => {
        const pubkey = new PublicKey(address);
        const accountInfo = await this.connection.getAccountInfo(
          pubkey,
          this.toSolanaCommitment(commitment)
        );

        if (!accountInfo) {
          return null;
        }

        const slot = await this.connection.getSlot(this.toSolanaCommitment(commitment));

        return {
          address,
          lamports: accountInfo.lamports.toString(),
          owner: accountInfo.owner.toBase58() as SolanaAddress,
          executable: accountInfo.executable,
          rentEpoch: accountInfo.rentEpoch ?? 0,
          data: accountInfo.data.toString('base64'),
          slot,
        };
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Account info fetch failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            { address, error: String(error) }
          );
        },
      }
    );
  }

  /**
   * Get SOL balance
   */
  async getBalance(
    address: SolanaAddress,
    commitment: Commitment = 'confirmed'
  ): Promise<bigint> {
    return pRetry(
      async () => {
        const pubkey = new PublicKey(address);
        const balance = await this.connection.getBalance(
          pubkey,
          this.toSolanaCommitment(commitment)
        );
        return BigInt(balance);
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Balance query failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            { address, error: String(error) }
          );
        },
      }
    );
  }

  /**
   * Get token accounts by owner
   *
   * Used to find SPL token balances
   */
  async getTokenAccountsByOwner(
    ownerAddress: SolanaAddress,
    mintAddress: SolanaAddress,
    commitment: Commitment = 'confirmed'
  ): Promise<PublicKey[]> {
    return pRetry(
      async () => {
        const owner = new PublicKey(ownerAddress);
        const mint = new PublicKey(mintAddress);

        const { value: accounts } = await this.connection.getTokenAccountsByOwner(
          owner,
          { mint },
          this.toSolanaCommitment(commitment)
        );

        return accounts.map((acc) => acc.pubkey);
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Token accounts query failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            { ownerAddress, mintAddress, error: String(error) }
          );
        },
      }
    );
  }

  /**
   * Get transaction
   */
  async getTransaction(
    signature: Signature,
    commitment: Commitment = 'confirmed'
  ): Promise<TransactionInfo | null> {
    return pRetry(
      async () => {
        // Only use 'confirmed' or 'finalized' for getTransaction
        const txCommitment = commitment === 'processed' ? 'confirmed' : commitment;

        const tx = await this.connection.getTransaction(signature, {
          commitment: txCommitment,
          maxSupportedTransactionVersion: 0,
        } as { commitment: 'confirmed' | 'finalized'; maxSupportedTransactionVersion: 0 });

        if (!tx) {
          return null;
        }

        return {
          signature,
          slot: tx.slot,
          blockTime: tx.blockTime ?? null,
          fee: tx.meta?.fee.toString() ?? '0',
          status: tx.meta?.err ? 'failed' : 'success',
          error: tx.meta?.err ? JSON.stringify(tx.meta.err) : null,
          computeUnitsConsumed: tx.meta?.computeUnitsConsumed ?? 0,
          logMessages: tx.meta?.logMessages ?? [],
          preBalances: (tx.meta?.preBalances ?? []).map((b) => b.toString()),
          postBalances: (tx.meta?.postBalances ?? []).map((b) => b.toString()),
          accounts: tx.transaction.message.getAccountKeys().keySegments().flat().map((k) => k.toBase58() as SolanaAddress),
        };
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Transaction fetch failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            { signature, error: String(error) }
          );
        },
      }
    );
  }

  /**
   * Get block
   */
  async getBlock(
    slot: number,
    commitment: Commitment = 'confirmed'
  ): Promise<BlockInfo | null> {
    return pRetry(
      async () => {
        // Only use 'confirmed' or 'finalized' for getBlock
        const blockCommitment = commitment === 'processed' ? 'confirmed' : commitment;

        const block = await this.connection.getBlock(slot, {
          commitment: blockCommitment,
          maxSupportedTransactionVersion: 0,
        } as { commitment: 'confirmed' | 'finalized'; maxSupportedTransactionVersion: 0 });

        if (!block) {
          return null;
        }

        // blockHeight might not exist on all block types
        const blockHeight = 'blockHeight' in block && typeof block.blockHeight === 'number'
          ? block.blockHeight
          : null;

        return {
          slot,
          blockhash: block.blockhash as Blockhash,
          previousBlockhash: block.previousBlockhash as Blockhash,
          parentSlot: block.parentSlot,
          transactions: (block.transactions ?? []).map((tx) => {
            const sig = tx.transaction.signatures[0];
            return sig ? (sig as Signature) : ('' as Signature);
          }).filter(sig => sig !== ''),
          blockTime: block.blockTime,
          blockHeight,
          rewards: (block.rewards ?? []).map((r) => ({
            pubkey: r.pubkey as SolanaAddress,
            lamports: r.lamports.toString(),
            rewardType: r.rewardType ?? 'unknown',
          })),
        };
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Block fetch failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            slot,
            error: String(error),
          });
        },
      }
    );
  }

  /**
   * Get current slot
   */
  async getSlot(commitment: Commitment = 'confirmed'): Promise<number> {
    return pRetry(
      async () => {
        return await this.connection.getSlot(this.toSolanaCommitment(commitment));
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(`Slot query failed (attempt ${error.attemptNumber}/${this.maxRetries})`, {
            error: String(error),
          });
        },
      }
    );
  }

  /**
   * Confirm transaction
   *
   * Waits for transaction to reach specified commitment level
   */
  async confirmTransaction(
    signature: Signature,
    commitment: Commitment = 'confirmed',
    timeout: number = 30000
  ): Promise<void> {
    const startTime = Date.now();

    return pRetry(
      async () => {
        if (Date.now() - startTime > timeout) {
          throw new SolanaError(
            'Transaction confirmation timeout',
            SolanaErrorCode.TIMEOUT,
            { signature, timeout }
          );
        }

        const status = await this.connection.getSignatureStatus(signature);

        if (!status || !status.value) {
          throw new Error('Transaction not found');
        }

        if (status.value.err) {
          throw new SolanaError(
            'Transaction failed',
            SolanaErrorCode.TRANSACTION_FAILED,
            { signature, error: JSON.stringify(status.value.err) }
          );
        }

        // Check if commitment level is met
        const confirmationStatus = status.value.confirmationStatus;
        if (commitment === 'finalized' && confirmationStatus !== 'finalized') {
          throw new Error('Waiting for finalized confirmation');
        }
        if (commitment === 'confirmed' && confirmationStatus === 'processed') {
          throw new Error('Waiting for confirmed status');
        }

        logger.info('Transaction confirmed', {
          signature,
          commitment,
          slot: status.value.slot,
        });
      },
      {
        retries: Math.floor(timeout / this.retryDelay),
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          const errorMsg = String(error);
          if (!errorMsg.includes('Transaction not found') &&
              !errorMsg.includes('Waiting for finalized confirmation') &&
              !errorMsg.includes('Waiting for confirmed status')) {
            logger.warn('Transaction confirmation failed', {
              signature,
              error: errorMsg,
            });
          }
        },
      }
    );
  }

  /**
   * Simulate transaction
   *
   * Used to validate transaction before sending
   */
  async simulateTransaction(_transaction: Uint8Array): Promise<{
    success: boolean;
    error: string | null;
    computeUnitsConsumed: number;
    logs: string[];
  }> {
    return pRetry(
      async () => {
        // Note: Simulation requires deserialized transaction
        // This is a simplified version - real implementation would need full transaction parsing
        throw new Error('Transaction simulation not yet implemented');
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Simulation failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            { error: String(error) }
          );
        },
      }
    );
  }

  /**
   * Request airdrop (devnet/testnet only)
   */
  async requestAirdrop(address: SolanaAddress, lamports: bigint): Promise<Signature> {
    return pRetry(
      async () => {
        const pubkey = new PublicKey(address);
        const signature = await this.connection.requestAirdrop(pubkey, Number(lamports));

        logger.info('Airdrop requested', {
          address,
          lamports: lamports.toString(),
          signature,
        });

        return signature as Signature;
      },
      {
        retries: this.maxRetries,
        minTimeout: this.retryDelay,
        onFailedAttempt: (error) => {
          logger.warn(
            `Airdrop request failed (attempt ${error.attemptNumber}/${this.maxRetries})`,
            { address, lamports: lamports.toString(), error: String(error) }
          );
        },
      }
    );
  }
}
